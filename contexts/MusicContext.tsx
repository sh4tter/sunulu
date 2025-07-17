// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, listAll, ref } from 'firebase/storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { db, storage } from '../config/firebase';
import { clearMusicWidget, showOrUpdateMusicWidget } from '../services/musicWidgetService';
import { useAuth } from './AuthContext';

interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  albumArt?: string;
}

interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

interface Participant {
  id: string;
  email: string;
  joinedAt: number;
}

interface SongLike {
  songId: string;
  userId: string;
  userName: string;
  timestamp: number;
}

interface SongMood {
  songId: string;
  userId: string;
  userName: string;
  mood: 'love' | 'party' | 'kiss' | 'thumbsup' | 'thumbsdown' | 'puke' | 'crying';
  timestamp: number;
}

interface MusicState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  volume: number;
  isShuffleEnabled: boolean;
  repeatMode: 'off' | 'all' | 'one';
}

interface MusicContextType extends MusicState {
  playSong: (song: Song) => Promise<void>;
  pauseSong: () => Promise<void>;
  resumeSong: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  seekTo: (time: number) => Promise<void>;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  createPlaylist: (name: string) => void;
  addToPlaylist: (playlistId: string, song: Song) => void;
  playPlaylist: (playlist: Playlist) => Promise<void>;
  setVolume: (volume: number) => void;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  currentRoom: string | null;
  loadSongsFromStorage: () => Promise<void>;
  refreshSongsFromServer: () => Promise<void>;
  clearSongCache: () => Promise<void>;
  participants: Participant[];
  lastPlayedBy: string | null;
  roomActivityNotification: { visible: boolean; message: string; onJoin?: () => void } | null;
  dismissRoomNotification: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  likeSong: (song: Song) => Promise<void>;
  getCurrentSongLikes: () => SongLike[];
  setSongMood: (song: Song, mood: 'love' | 'party' | 'kiss' | 'thumbsup' | 'thumbsdown' | 'puke' | 'crying') => Promise<void>;
  getCurrentSongMood: () => SongMood | null;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

const SONG_CACHE_DIR = `${FileSystem.documentDirectory}song-cache/`;
const MAX_CACHE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const CACHED_SONGS_KEY = 'cached_songs';
const CACHE_TIMESTAMP_KEY = 'songs_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

async function ensureCacheDir() {
  const dirInfo = await FileSystem.getInfoAsync(SONG_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SONG_CACHE_DIR, { intermediates: true });
  }
}

async function getCacheSize(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(SONG_CACHE_DIR, { size: true });
    // @ts-ignore – size is available when `size: true`
    return dirInfo.size ?? 0;
  } catch {
    return 0;
  }
}

// Cache songs to AsyncStorage
async function cacheSongsToStorage(songs: Song[]): Promise<void> {
  try {
    const songsData = JSON.stringify(songs);
    await AsyncStorage.setItem(CACHED_SONGS_KEY, songsData);
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    console.log('💾 Cached songs to AsyncStorage');
  } catch (error) {
    console.error('❌ Error caching songs to AsyncStorage:', error);
  }
}

// Load cached songs from AsyncStorage
async function loadCachedSongs(): Promise<Song[] | null> {
  try {
    const cachedSongs = await AsyncStorage.getItem(CACHED_SONGS_KEY);
    const cacheTimestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!cachedSongs || !cacheTimestamp) {
      return null;
    }
    
    const timestamp = parseInt(cacheTimestamp);
    const now = Date.now();
    
    // Check if cache is still valid (24 hours)
    if (now - timestamp > CACHE_DURATION) {
      console.log('⏰ Song cache expired, will fetch fresh data');
      return null;
    }
    
    const songs = JSON.parse(cachedSongs);
    console.log('📱 Loaded cached songs from AsyncStorage');
    return songs;
  } catch (error) {
    console.error('❌ Error loading cached songs:', error);
    return null;
  }
}

async function cacheSongFile(remoteUrl: string, filename: string): Promise<string> {
  try {
    await ensureCacheDir();
    const localUri = `${SONG_CACHE_DIR}${filename}`;

    // If we already have the file cached, return it immediately
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) {
      return localUri;
    }

    // Check total cache size – simple safeguard (no LRU deletion for brevity)
    const currentSize = await getCacheSize();
    if (currentSize > MAX_CACHE_SIZE_BYTES) {
      console.log('⚠️ Song cache exceeded 1GB – skipping download');
      return remoteUrl;
    }

    console.log('⏬ Downloading song for offline cache:', filename);
    await FileSystem.downloadAsync(remoteUrl, localUri);
    return localUri;
  } catch (err) {
    console.log('Cache download error, using remote URL', err);
    return remoteUrl;
  }
}

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<MusicState>({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    playlists: [],
    currentPlaylist: null,
    volume: 1.0,
    isShuffleEnabled: false,
    repeatMode: 'off',
  });
  
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lastPlayedBy, setLastPlayedBy] = useState<string | null>(null);
  const [currentSongLikes, setCurrentSongLikes] = useState<SongLike[]>([]);
  const [currentSongMood, setCurrentSongMood] = useState<SongMood | null>(null);
  const [roomActivityNotification, setRoomActivityNotification] = useState<{
    visible: boolean;
    message: string;
    onJoin?: () => void;
  } | null>(null);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const roomListenerRef = useRef<(() => void) | null>(null);
  const shuffledQueue = useRef<Song[]>([]);

  // Timestamp-based sync state
  const lastActionTimeRef = useRef<Date | null>(null);
  const lastActionSeekPositionRef = useRef<number>(0);
  const isUpdatingFromFirestoreRef = useRef(false);
  const seekDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio
  useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('🎵 Audio initialized');
      } catch (error) {
        console.error('❌ Error initializing audio:', error);
      }
    };

    initAudio();
  }, []);

  // Auto-join listening room
  useEffect(() => {
    const autoJoinListeningRoom = async () => {
      if (user && !currentRoom) {
        try {
          await joinRoom('listening');
        } catch (error) {
          console.error('❌ Error auto-joining room:', error);
        }
      }
    };

    autoJoinListeningRoom();
  }, [user]);

  // Extract metadata from audio files
  const extractMetadata = async (fileUrl: string, fileName: string, filePath?: string): Promise<{ title: string; artist: string; albumArt?: string }> => {
    try {
      // Parse filename for basic metadata
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      const parts = nameWithoutExt.split(' - ');
      
      let title = nameWithoutExt;
      let artist = 'Unknown Artist';
      
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }
      
      // Try to find corresponding album art
      let albumArt: string | undefined = undefined;
      try {
        // Look for common album art file names
        const possibleAlbumArtNames = [
          `${nameWithoutExt}.jpg`,
          `${nameWithoutExt}.jpeg`,
          `${nameWithoutExt}.png`,
          `${artist} - album.jpg`,
          `${artist} - album.jpeg`,
          `${artist} - album.png`,
          'cover.jpg',
          'cover.jpeg',
          'cover.png',
          'album.jpg',
          'album.jpeg',
          'album.png',
        ];

        // Try to get album art from the same directory as the audio file
        for (const artName of possibleAlbumArtNames) {
          try {
            let artRef;
            if (filePath) {
              // If we have a specific path, look in that directory
              artRef = ref(storage, `${filePath}/${artName}`);
            } else {
              // Fallback to root directory
              artRef = ref(storage, artName);
            }
            const artUrl = await getDownloadURL(artRef);
            albumArt = artUrl;
            console.log(`🎨 Found album art: ${artName} in ${filePath || 'root'}`);
            break;
          } catch (artError) {
            // Continue to next possible name
          }
        }

        // If no specific album art found, try a generic music placeholder
        if (!albumArt) {
          try {
            const placeholderRef = ref(storage, 'music-placeholder.jpg');
            albumArt = await getDownloadURL(placeholderRef);
          } catch (placeholderError) {
            // No placeholder available
          }
        }
      } catch (error) {
        console.log('No album art found for:', fileName);
      }
      
      return { title, artist, albumArt };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {
        title: fileName.replace(/\.[^/.]+$/, ""),
        artist: 'Unknown Artist',
        albumArt: undefined,
      };
    }
  };

  // Load songs from Firebase Storage
  const loadSongsFromStorage = async () => {
    try {
      console.log('🔍 Loading songs...');
      
      if (!user) {
        console.log('❌ No user logged in');
        return;
      }

      // First, try to load cached song metadata
      const cachedSongs = await loadCachedSongs();
      if (cachedSongs && cachedSongs.length > 0) {
        console.log(`📱 Using cached song metadata: ${cachedSongs.length} songs`);
        setState(prev => ({
          ...prev,
          queue: cachedSongs,
        }));
        return; // Use cached metadata, don't fetch from server
      }

      console.log('🔍 No valid cache found, loading song metadata from Firebase Storage...');
      
      let songs: Song[] = [];
      let foundPath = '';
      
      // Try root directory first
      console.log('🔍 Trying to access root directory first...');
      try {
        const rootRef = ref(storage);
        const rootResult = await listAll(rootRef);
        
        console.log(`📁 Root directory contains ${rootResult.items.length} items`);
        
        if (rootResult.items.length > 0) {
          for (const itemRef of rootResult.items) {
            try {
              // Only process audio files
              const fileName = itemRef.name.toLowerCase();
              console.log(`📄 Found file: ${fileName}`);
              
              if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || 
                  fileName.endsWith('.m4a') || fileName.endsWith('.aac') ||
                  fileName.endsWith('.flac') || fileName.endsWith('.ogg')) {
                
                console.log(`🎵 Processing audio file metadata: ${fileName}`);
                const downloadUrl = await getDownloadURL(itemRef);
                const metadata = await extractMetadata(downloadUrl, itemRef.name, foundPath);
                
                const song: Song = {
                  id: itemRef.name,
                  title: metadata.title,
                  artist: metadata.artist,
                  url: downloadUrl, // Keep remote URL, will download on-demand
                  duration: 0, // Will be set when the song is loaded
                  albumArt: metadata.albumArt,
                };
                
                songs.push(song);
                console.log(`✅ Loaded song metadata: ${song.title} by ${song.artist}`);
              }
            } catch (fileError) {
              console.error(`❌ Error loading file ${itemRef.name}:`, fileError);
            }
          }
          
          if (songs.length > 0) {
            foundPath = 'root';
          }
        }
      } catch (rootError) {
        console.log('📁 Root directory not accessible');
      }
        
      // If no songs found in root, try subdirectories
      if (songs.length === 0) {
        console.log('🔍 No songs in root, trying subdirectories...');
        
        const possiblePaths = [
          `users/${user.uid}/music`,
          `music`,
          `songs`,
        ];

        for (const path of possiblePaths) {
          try {
            console.log(`🔍 Trying path: ${path}`);
            const musicRef = ref(storage, path);
            const result = await listAll(musicRef);
        
            if (result.items.length > 0) {
              console.log(`📁 Found ${result.items.length} files in path: ${path}`);
              foundPath = path;
              
              for (const itemRef of result.items) {
                try {
                  // Only process audio files
                  const fileName = itemRef.name.toLowerCase();
                  if (fileName.endsWith('.mp3') || fileName.endsWith('.wav') || 
                      fileName.endsWith('.m4a') || fileName.endsWith('.aac') ||
                      fileName.endsWith('.flac') || fileName.endsWith('.ogg')) {
                    
                    const downloadUrl = await getDownloadURL(itemRef);
                    const metadata = await extractMetadata(downloadUrl, itemRef.name, foundPath);
                    
                    const song: Song = {
                      id: itemRef.name,
                      title: metadata.title,
                      artist: metadata.artist,
                      url: downloadUrl, // Keep remote URL, will download on-demand
                      duration: 0, // Will be set when the song is loaded
                      albumArt: metadata.albumArt,
                    };
                    
                    songs.push(song);
                    console.log(`✅ Loaded song metadata: ${song.title} by ${song.artist}`);
                  }
                } catch (fileError) {
                  console.error(`❌ Error loading file ${itemRef.name}:`, fileError);
                }
              }
              break; // Found songs, stop searching
            }
          } catch (pathError) {
            console.log(`📁 Path ${path} not accessible or empty`);
          }
        }
      }
      
      if (songs.length > 0) {
        // Cache the song metadata to AsyncStorage
        await cacheSongsToStorage(songs);
        
        // Update queue with loaded song metadata
        setState(prev => ({
          ...prev,
          queue: songs,
        }));
        
        console.log(`🎵 Added ${songs.length} song metadata to queue from path: ${foundPath || 'root'}`);
        console.log('💡 Songs will be downloaded on-demand when played');
      } else {
        console.log('📁 No audio files found in any storage location');
        console.log('💡 Make sure you have added MP3, WAV, M4A, AAC, FLAC, or OGG files');
      }
      
    } catch (error) {
      console.error('❌ Error loading songs from storage:', error);
    }
  };

  // Calculate current position based on timestamp
  const calculateCurrentPosition = (lastActionTime: Date, lastActionSeekPosition: number): number => {
    if (!lastActionTime) return lastActionSeekPosition;
    
    const now = new Date();
    const elapsedTime = (now.getTime() - lastActionTime.getTime()) / 1000; // Convert to seconds
    return lastActionSeekPosition + elapsedTime;
  };

  // Update play/pause state in Firestore
  const updatePlayPauseState = async (isPlaying: boolean, currentSeekPosition: number) => {
    if (!currentRoom || !user) return;

    try {
      const updateData = {
        isPlaying,
        lastActionTime: serverTimestamp(),
        lastActionSeekPosition: currentSeekPosition,
        lastActionByUserId: user.uid,
      };
      
      await updateDoc(doc(db as any, 'rooms', currentRoom), updateData);
      
      console.log('🔄 [WRITE] Updated play/pause state:', {
        isPlaying,
        currentSeekPosition,
        userId: user.uid,
        timestamp: 'serverTimestamp()',
      });
    } catch (error) {
      console.error('❌ Error updating play/pause state:', error);
    }
  };

  // Update seek position in Firestore (debounced)
  const updateSeekPosition = async (newSeekPosition: number) => {
    if (!currentRoom || !user) return;

    // Clear existing debounce
    if (seekDebounceRef.current) {
      clearTimeout(seekDebounceRef.current);
    }

    // Debounce seek updates
    seekDebounceRef.current = setTimeout(async () => {
      try {
        const updateData = {
          lastActionTime: serverTimestamp(),
          lastActionSeekPosition: newSeekPosition,
          lastActionByUserId: user.uid,
        };
        
        await updateDoc(doc(db as any, 'rooms', currentRoom), updateData);
        
        console.log('🔄 [WRITE] Updated seek position:', {
          newSeekPosition,
          userId: user.uid,
          timestamp: 'serverTimestamp()',
        });
      } catch (error) {
        console.error('❌ Error updating seek position:', error);
      }
    }, 500); // 500ms debounce
  };

  // Update track in Firestore
  const updateTrack = async (song: Song) => {
    if (!currentRoom || !user) return;

    try {
      const updateData = {
        currentTrackId: song.id,
        isPlaying: true,
        lastActionTime: serverTimestamp(),
        lastActionSeekPosition: 0,
        lastActionByUserId: user.uid,
      };
      
      await updateDoc(doc(db as any, 'rooms', currentRoom), updateData);
      
      console.log('🔄 [WRITE] Updated track:', {
        currentTrackId: song.id,
        songTitle: song.title,
        userId: user.uid,
        timestamp: 'serverTimestamp()',
      });
    } catch (error) {
      console.error('❌ Error updating track:', error);
    }
  };

  const playSong = async (song: Song) => {
    try {
      console.log('🎵 [USER] Playing song:', song.title);
      
      // Stop current song if playing
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }

      // Check if song is already cached locally
      let songUrl = song.url;
      const localUri = `${SONG_CACHE_DIR}${song.id}`;
      const localFileInfo = await FileSystem.getInfoAsync(localUri);
      
      if (localFileInfo.exists) {
        console.log('📱 Using cached song file');
        songUrl = localUri;
      } else {
        console.log('⏬ Downloading song on-demand...');
        try {
          // Download the song file
          await ensureCacheDir();
          await FileSystem.downloadAsync(song.url, localUri);
          songUrl = localUri;
          console.log('✅ Song downloaded and cached');
          
          // Preload next song in background
          preloadNextSong();
        } catch (downloadError) {
          console.log('⚠️ Failed to download song, using remote URL:', downloadError);
          songUrl = song.url; // Fallback to remote URL
        }
      }

      // Load and play new song
      const { sound } = await Audio.Sound.createAsync(
        { uri: songUrl },
        { shouldPlay: true, volume: state.volume }
      );
      
      soundRef.current = sound;
      
      // Set up playback status update
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const currentPos = (status.positionMillis || 0) / 1000;
          setState(prev => ({ 
            ...prev, 
            currentTime: currentPos,
            duration: status.durationMillis ? status.durationMillis / 1000 : 0,
          }));
          
          // Auto-skip when song ends (unless repeat one is enabled)
          if (status.didJustFinish && state.repeatMode !== 'one') {
            skipNext();
          }
        }
      });
      
      // Optimistic update - immediate local change
      setState(prev => ({
        ...prev,
        currentSong: song,
        isPlaying: true,
        currentTime: 0,
        duration: song.duration,
      }));

      // Show music widget immediately
      const currentMood = getCurrentSongMood();
      const vibeText = currentMood ? `${currentMood.mood} by ${currentMood.userName}` : undefined;
      await showOrUpdateMusicWidget(song as MiniSong, true, 0, vibeText);

      // Update Firestore with new track
      await updateTrack(song);

      // Update last played by
      if (currentRoom && user) {
        setLastPlayedBy(user.email?.split('@')[0] || 'Unknown');
      }

      // Clear mood when song changes
      setCurrentSongMood(null);
      
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  // Preload next song in background
  const preloadNextSong = async () => {
    try {
      const queueToUse = state.isShuffleEnabled ? shuffledQueue.current : state.queue;
      const currentIndex = queueToUse.findIndex(s => s.id === state.currentSong?.id);
      
      if (currentIndex < queueToUse.length - 1) {
        const nextSong = queueToUse[currentIndex + 1];
        const localUri = `${SONG_CACHE_DIR}${nextSong.id}`;
        const localFileInfo = await FileSystem.getInfoAsync(localUri);
        
        if (!localFileInfo.exists) {
          console.log('🔄 Preloading next song:', nextSong.title);
          await ensureCacheDir();
          await FileSystem.downloadAsync(nextSong.url, localUri);
          console.log('✅ Next song preloaded');
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to preload next song:', error);
    }
  };

  const pauseSong = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        
        if (status.isLoaded && status.isPlaying) {
          console.log('⏸️ [USER] Pausing song - optimistic update');
          
          // Optimistic update - immediate local change
          await soundRef.current.pauseAsync();
          setState(prev => ({ ...prev, isPlaying: false }));

          if (state.currentSong) {
            const currentMood = getCurrentSongMood();
            const vibeText = currentMood ? `${currentMood.mood} by ${currentMood.userName}` : undefined;
            await showOrUpdateMusicWidget(state.currentSong as MiniSong, false, state.currentTime, vibeText);
          }

          // Update Firestore in background
          const currentPos = status.positionMillis ? status.positionMillis / 1000 : 0;
          console.log('⏸️ [USER] Current position when pausing:', currentPos);
          await updatePlayPauseState(false, currentPos);
        }
      }
    } catch (error) {
      console.error('Error pausing song:', error);
    }
  };

  const resumeSong = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        
        if (status.isLoaded && !status.isPlaying) {
          console.log('▶️ [USER] Resuming song - optimistic update');
          
          // Optimistic update - immediate local change
          await soundRef.current.playAsync();
          setState(prev => ({ ...prev, isPlaying: true }));

          if (state.currentSong) {
            const currentMood = getCurrentSongMood();
            const vibeText = currentMood ? `${currentMood.mood} by ${currentMood.userName}` : undefined;
            await showOrUpdateMusicWidget(state.currentSong as MiniSong, true, state.currentTime, vibeText);
          }

          // Update Firestore in background
          const currentPos = status.positionMillis ? status.positionMillis / 1000 : 0;
          console.log('▶️ [USER] Current position when resuming:', currentPos);
          await updatePlayPauseState(true, currentPos);
        }
      }
    } catch (error) {
      console.error('Error resuming song:', error);
    }
  };

  const seekTo = async (time: number) => {
    try {
      if (soundRef.current) {
        console.log('⏩ [USER] Seeking to position:', time);
        
        // Optimistic update - immediate local change
        await soundRef.current.setPositionAsync(time * 1000);
        setState(prev => ({ ...prev, currentTime: time }));

        // Immediately update music widget for seek
        if (state.currentSong) {
          const currentMood = getCurrentSongMood();
          const vibeText = currentMood ? `${currentMood.mood} by ${currentMood.userName}` : undefined;
          await showOrUpdateMusicWidget(state.currentSong as MiniSong, state.isPlaying, time, vibeText);
        }

        // Update Firestore with debounced seek
        await updateSeekPosition(time);
      }
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const skipNext = async () => {
    if (state.repeatMode === 'one' && state.currentSong) {
      // Repeat current song
      await playSong(state.currentSong);
      return;
    }

    const queueToUse = state.isShuffleEnabled ? shuffledQueue.current : state.queue;
    const currentIndex = queueToUse.findIndex(song => song.id === state.currentSong?.id);
    
    if (currentIndex < queueToUse.length - 1) {
      const nextSong = queueToUse[currentIndex + 1];
      await playSong(nextSong);
      
      // Preload the song after next
      if (currentIndex + 2 < queueToUse.length) {
        const songAfterNext = queueToUse[currentIndex + 2];
        preloadSpecificSong(songAfterNext);
      }
    } else if (state.repeatMode === 'all' && queueToUse.length > 0) {
      // Repeat queue from beginning
      await playSong(queueToUse[0]);
      
      // Preload second song
      if (queueToUse.length > 1) {
        preloadSpecificSong(queueToUse[1]);
      }
    }
  };

  const skipPrevious = async () => {
    if (state.repeatMode === 'one' && state.currentSong) {
      // Repeat current song
      await playSong(state.currentSong);
      return;
    }

    const queueToUse = state.isShuffleEnabled ? shuffledQueue.current : state.queue;
    const currentIndex = queueToUse.findIndex(song => song.id === state.currentSong?.id);
    
    if (currentIndex > 0) {
      const prevSong = queueToUse[currentIndex - 1];
      await playSong(prevSong);
      
      // Preload the song before previous
      if (currentIndex > 1) {
        const songBeforePrev = queueToUse[currentIndex - 2];
        preloadSpecificSong(songBeforePrev);
      }
    } else if (state.repeatMode === 'all' && queueToUse.length > 0) {
      // Go to last song in queue
      const lastSong = queueToUse[queueToUse.length - 1];
      await playSong(lastSong);
      
      // Preload second to last song
      if (queueToUse.length > 1) {
        const secondToLastSong = queueToUse[queueToUse.length - 2];
        preloadSpecificSong(secondToLastSong);
      }
    }
  };

  // Preload a specific song
  const preloadSpecificSong = async (song: Song) => {
    try {
      const localUri = `${SONG_CACHE_DIR}${song.id}`;
      const localFileInfo = await FileSystem.getInfoAsync(localUri);
      
      if (!localFileInfo.exists) {
        console.log('🔄 Preloading specific song:', song.title);
        await ensureCacheDir();
        await FileSystem.downloadAsync(song.url, localUri);
        console.log('✅ Specific song preloaded:', song.title);
      }
    } catch (error) {
      console.log('⚠️ Failed to preload specific song:', error);
    }
  };

  const addToQueue = (song: Song) => {
    setState(prev => ({
      ...prev,
      queue: [...prev.queue, song],
    }));
  };

  const removeFromQueue = (index: number) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter((_, i) => i !== index),
    }));
  };

  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      songs: [],
    };
    setState(prev => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
    }));
  };

  const addToPlaylist = (playlistId: string, song: Song) => {
    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(playlist =>
        playlist.id === playlistId
          ? { ...playlist, songs: [...playlist.songs, song] }
          : playlist
      ),
    }));
  };

  const playPlaylist = async (playlist: Playlist) => {
    if (playlist.songs.length > 0) {
      setState(prev => ({
        ...prev,
        queue: playlist.songs,
        currentPlaylist: playlist,
      }));
      await playSong(playlist.songs[0]);
    }
  };

  // Update progress tracking
  useEffect(() => {
    const updateProgress = async () => {
      if (soundRef.current && state.isPlaying) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            const currentPos = status.positionMillis ? status.positionMillis / 1000 : 0;
            setState(prev => ({
              ...prev,
              currentTime: currentPos,
              duration: status.durationMillis ? status.durationMillis / 1000 : 0,
            }));
          }
        } catch (error) {
          console.error('Error updating progress:', error);
        }
      }
    };

    const progressInterval = setInterval(updateProgress, 1000);
    
    return () => {
      clearInterval(progressInterval);
    };
  }, [state.isPlaying]);

  // Cleanup music widget when component unmounts
  useEffect(() => {
    return () => {
      clearMusicWidget();
    };
  }, []);

  // Room participant tracking
  useEffect(() => {
    if (currentRoom && user) {
      console.log('👥 Setting up participants listener for room:', currentRoom);
      
      // Listen to participants in the room
      const roomRef = doc(db as any, 'rooms', currentRoom);
      const unsubscribe = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
          const roomData = doc.data();
          const roomParticipants = roomData.participants || [];
          
          // Filter out current user from participants list
          const otherParticipants = roomParticipants.filter((p: Participant) => p.id !== user.uid);
          setParticipants(otherParticipants);
          
          console.log(`👥 Updated participants: ${otherParticipants.length} others in room`);
        }
      });

      return () => {
        console.log('🔇 Cleaning up participants listener');
        unsubscribe();
      };
    } else {
      setParticipants([]);
    }
  }, [currentRoom, user]);

  // Generate shuffled queue when shuffle is enabled
  useEffect(() => {
    if (state.isShuffleEnabled && state.queue.length > 0) {
      const currentIndex = state.queue.findIndex(song => song.id === state.currentSong?.id);
      const otherSongs = state.queue.filter((_, index) => index !== currentIndex);
      const shuffled = [...otherSongs].sort(() => Math.random() - 0.5);
      
      if (state.currentSong) {
        shuffledQueue.current = [state.currentSong, ...shuffled];
      } else {
        shuffledQueue.current = shuffled;
      }
    }
  }, [state.isShuffleEnabled, state.queue, state.currentSong]);

  const setVolume = (volume: number) => {
    setState(prev => ({ ...prev, volume }));
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(volume);
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');

      console.log('🚪 Joining room:', roomId);
      
      const roomRef = doc(db as any, 'rooms', roomId);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        // Create room with initial state
        await setDoc(roomRef, {
          id: roomId,
          participants: [{
            id: user.uid,
            email: user.email,
            joinedAt: Date.now(),
          }],
          currentTrackId: null,
          isPlaying: false,
          lastActionTime: serverTimestamp(),
          lastActionSeekPosition: 0,
          lastActionByUserId: null,
          createdAt: Date.now(),
        });
      } else {
        // Add user to existing room
        const roomData = roomDoc.data();
        const participants = roomData.participants || [];
        
        const existingParticipant = participants.find((p: Participant) => p.id === user.uid);
        
        if (!existingParticipant) {
          participants.push({
            id: user.uid,
            email: user.email,
            joinedAt: Date.now(),
          });
          
          await updateDoc(roomRef, { participants });
        }
      }

      setCurrentRoom(roomId);
      
      // Set up real-time listener
      if (roomListenerRef.current) {
        roomListenerRef.current();
      }
      
      roomListenerRef.current = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          
          console.log('📡 [RECEIVE] Raw Firestore data:', data);
          
          // Handle self-updates (ignore if we're the one who made the change)
          if (data.lastActionByUserId === user.uid) {
            console.log('🔄 [RECEIVE] Ignoring self-update from user:', user.uid);
            return;
          }

          console.log('🔄 [RECEIVE] Processing update from other user:', data.lastActionByUserId);
          
          // Update local state based on Firestore data
          if (data.currentTrackId && data.currentTrackId !== state.currentSong?.id) {
            console.log('🎵 [RECEIVE] Track change detected:', {
              newTrackId: data.currentTrackId,
              currentTrackId: state.currentSong?.id,
            });
            
            // Find the song in our queue
            const song = state.queue.find(s => s.id === data.currentTrackId);
            if (song) {
              console.log('🎵 [RECEIVE] Loading new track:', song.title);
              playSong(song);
            } else {
              console.log('⚠️ [RECEIVE] Track not found in queue:', data.currentTrackId);
            }
          }

          // Calculate current position and update player
          if (data.lastActionTime && data.lastActionSeekPosition !== undefined) {
            // Convert Firestore Timestamp to milliseconds
            const lastActionTimeMillis = data.lastActionTime.toMillis();
            const lastActionTime = new Date(lastActionTimeMillis);
            const currentLocalTime = Date.now();
            const elapsedTime = (currentLocalTime - lastActionTimeMillis) / 1000; // Convert to seconds
            const calculatedPosition = data.lastActionSeekPosition + elapsedTime;
            
            console.log('⏰ [RECEIVE] Time calculation:', {
              lastActionTime: lastActionTime.toISOString(),
              lastActionTimeMillis,
              currentLocalTime,
              elapsedTimeSeconds: elapsedTime,
              lastActionSeekPosition: data.lastActionSeekPosition,
              calculatedPosition,
              isPlaying: data.isPlaying,
            });
            
            // Update player state immediately
            if (soundRef.current) {
              soundRef.current.getStatusAsync().then(status => {
                if (status.isLoaded) {
                  console.log('🎵 [RECEIVE] Updating player state:', {
                    currentPosition: status.positionMillis ? status.positionMillis / 1000 : 0,
                    calculatedPosition,
                    isPlaying: data.isPlaying,
                    wasPlaying: status.isPlaying,
                  });
                  
                  // Seek to calculated position immediately
                  soundRef.current?.setPositionAsync(calculatedPosition * 1000);
                  setState(prev => ({ ...prev, currentTime: calculatedPosition }));
                  
                  // Update play/pause state immediately
                  if (data.isPlaying !== state.isPlaying) {
                    if (data.isPlaying) {
                      console.log('▶️ [RECEIVE] Starting playback');
                      soundRef.current?.playAsync();
                      setState(prev => ({ ...prev, isPlaying: true }));
                    } else {
                      console.log('⏸️ [RECEIVE] Pausing playback');
                      soundRef.current?.pauseAsync();
                      setState(prev => ({ ...prev, isPlaying: false }));
                    }
                  } else {
                    console.log('🔄 [RECEIVE] Play/pause state unchanged');
                  }
                } else {
                  console.log('⚠️ [RECEIVE] Sound not loaded, cannot update');
                }
              }).catch((error) => {
                console.error('❌ [RECEIVE] Error updating player state:', error);
              });
            } else {
              console.log('⚠️ [RECEIVE] No sound reference available');
            }
          } else {
            console.log('⚠️ [RECEIVE] Missing timestamp or seek position data');
          }
        }
      });

      console.log('✅ Successfully joined room');
    } catch (error) {
      console.error('❌ Error joining room:', error);
      throw error;
    }
  };

  const leaveRoom = async () => {
    try {
      if (currentRoom && user) {
        console.log('🚪 Leaving room');
        
        const roomRef = doc(db as any, 'rooms', currentRoom);
        const roomDoc = await getDoc(roomRef);
        
        if (roomDoc.exists()) {
          const roomData = roomDoc.data();
          const participants = roomData.participants || [];
          
          // Remove user from participants
          const updatedParticipants = participants.filter((p: Participant) => p.id !== user.uid);
          
          // Never delete the room, just remove the user
          await updateDoc(roomRef, { 
            participants: updatedParticipants,
          });
        }
        
        // Clean up listener
        if (roomListenerRef.current) {
          roomListenerRef.current();
          roomListenerRef.current = null;
        }
        
        setCurrentRoom(null);
        setParticipants([]);
        setLastPlayedBy(null);
        
        // Clear now-playing notification when leaving room
        await clearMusicWidget();
        
        console.log('✅ Successfully left room');
      }
    } catch (error) {
      console.error('❌ Error leaving room:', error);
      throw error;
    }
  };

  const dismissRoomNotification = () => {
    setRoomActivityNotification(null);
  };

  const toggleShuffle = () => {
    setState(prev => ({ ...prev, isShuffleEnabled: !prev.isShuffleEnabled }));
  };

  const toggleRepeat = () => {
    setState(prev => ({
      ...prev,
      repeatMode: prev.repeatMode === 'off' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'off',
    }));
  };

  const likeSong = async (song: Song) => {
    if (!user || !currentRoom) return;

    try {
      const userName = user.email?.split('@')[0] || 'Unknown';
      const like: SongLike = {
        songId: song.id,
        userId: user.uid,
        userName,
        timestamp: Date.now(),
      };

      // Update room with like information
      await updateDoc(doc(db as any, 'rooms', currentRoom), {
        [`likes.${song.id}.${user.uid}`]: like,
        lastUpdated: Date.now(),
        updatedBy: user.uid,
      });

      // Update local state
      setCurrentSongLikes(prev => {
        const filtered = prev.filter(l => !(l.songId === song.id && l.userId === user.uid));
        return [...filtered, like];
      });

    } catch (error) {
      console.error('Error liking song:', error);
    }
  };

  const getCurrentSongLikes = (): SongLike[] => {
    if (!state.currentSong) return [];
    return currentSongLikes.filter(like => like.songId === state.currentSong!.id);
  };

  const setSongMood = async (song: Song, mood: 'love' | 'party' | 'kiss' | 'thumbsup' | 'thumbsdown' | 'puke' | 'crying') => {
    if (!user) return;

    try {
      const userName = user.email?.split('@')[0] || 'Unknown';
      const songMood: SongMood = {
        songId: song.id,
        userId: user.uid,
        userName,
        mood,
        timestamp: Date.now(),
      };

      // Update local state immediately
      setCurrentSongMood(songMood);

      // Update room with mood information if in a room
      if (currentRoom) {
        await updateDoc(doc(db as any, 'rooms', currentRoom), {
          [`moods.${song.id}.${user.uid}`]: songMood,
          lastUpdated: Date.now(),
          updatedBy: user.uid,
        });
      }

      // Update music widget with new mood
      if (state.currentSong && state.currentSong.id === song.id) {
        const vibeText = `${mood} by ${userName}`;
        await showOrUpdateMusicWidget(song as MiniSong, state.isPlaying, state.currentTime, vibeText);
      }

    } catch (error) {
      console.error('Error setting song mood:', error);
    }
  };

  const getCurrentSongMood = (): SongMood | null => {
    if (!state.currentSong) return null;
    return currentSongMood;
  };

  const refreshSongsFromServer = async () => {
    try {
      console.log('🔄 Force refreshing songs from server...');
      
      // Clear the cache first
      await clearSongCache();
      
      // Load fresh data from server
      await loadSongsFromStorage();
      
      console.log('✅ Songs refreshed from server');
    } catch (error) {
      console.error('❌ Error refreshing songs:', error);
    }
  };

  const clearSongCache = async () => {
    try {
      console.log('🗑️ Clearing song cache...');
      
      // Clear AsyncStorage cache
      await AsyncStorage.removeItem(CACHED_SONGS_KEY);
      await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
      
      // Clear file cache directory
      try {
        const dirInfo = await FileSystem.getInfoAsync(SONG_CACHE_DIR);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(SONG_CACHE_DIR);
          await FileSystem.makeDirectoryAsync(SONG_CACHE_DIR, { intermediates: true });
        }
      } catch (fileError) {
        console.log('⚠️ Could not clear file cache:', fileError);
      }
      
      console.log('✅ Song cache cleared');
    } catch (error) {
      console.error('❌ Error clearing song cache:', error);
    }
  };

  const value = {
    ...state,
    currentRoom,
    participants,
    playSong,
    pauseSong,
    resumeSong,
    skipNext,
    skipPrevious,
    seekTo,
    addToQueue,
    removeFromQueue,
    createPlaylist,
    addToPlaylist,
    playPlaylist,
    setVolume,
    joinRoom,
    leaveRoom,
    loadSongsFromStorage,
    refreshSongsFromServer,
    clearSongCache,
    lastPlayedBy,
    roomActivityNotification,
    dismissRoomNotification,
    toggleShuffle,
    toggleRepeat,
    likeSong,
    getCurrentSongLikes,
    setSongMood,
    getCurrentSongMood,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};