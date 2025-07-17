import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Toast, toastManager } from '../../components/Toast';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';

interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  albumArt?: string;
}

interface PlaylistData {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  songIds: string[];
}

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { queue, playSong } = useMusic();
  
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  // Setup toast manager
  useEffect(() => {
    toastManager.setShowToastCallback((message, type = 'info') => {
      setToastMessage(message);
      setToastType(type);
      setToastVisible(true);
    });
  }, []);

  // Load playlist data
  useEffect(() => {
    const loadPlaylist = async () => {
      if (!id || !user) return;

      try {
        const playlistDoc = await getDoc(doc(db as any, 'playlists', id as string));
        if (playlistDoc.exists()) {
          const data = playlistDoc.data();
          const playlistData: PlaylistData = {
            id: playlistDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          };
          setPlaylist(playlistData);

          // Filter songs that are in this playlist
          const songsInPlaylist = queue.filter(song => 
            data.songIds.includes(song.id)
          );
          setPlaylistSongs(songsInPlaylist);
        }
      } catch (error) {
        toastManager.showToast('Failed to load playlist', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [id, user, queue]);

  const addSongToPlaylist = async (song: Song) => {
    if (!playlist || !user) return;

    try {
      // Check if song is already in playlist
      if (playlist.songIds.includes(song.id)) {
        toastManager.showToast('Song already in playlist', 'info');
        return;
      }

      // Update Firestore
      await updateDoc(doc(db as any, 'playlists', playlist.id), {
        songIds: arrayUnion(song.id),
      });

      // Update local state
      setPlaylist(prev => prev ? {
        ...prev,
        songIds: [...prev.songIds, song.id]
      } : null);
      setPlaylistSongs(prev => [...prev, song]);

      toastManager.showToast('Song added to playlist!', 'success');
    } catch (error) {
      toastManager.showToast('Failed to add song', 'error');
    }
  };

  const removeSongFromPlaylist = async (songId: string) => {
    if (!playlist || !user) return;

    try {
      // Update Firestore
      const newSongIds = playlist.songIds.filter(id => id !== songId);
      await updateDoc(doc(db as any, 'playlists', playlist.id), {
        songIds: newSongIds,
      });

      // Update local state
      setPlaylist(prev => prev ? {
        ...prev,
        songIds: newSongIds
      } : null);
      setPlaylistSongs(prev => prev.filter(song => song.id !== songId));

      toastManager.showToast('Song removed from playlist', 'success');
    } catch (error) {
      toastManager.showToast('Failed to remove song', 'error');
    }
  };

  // Filter recommended songs (exclude songs already in playlist)
  const recommendedSongs = queue.filter(song => 
    !playlist?.songIds.includes(song.id) &&
    (searchQuery === '' || 
     song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     song.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#000000" barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading playlist...</Text>
        </View>
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#000000" barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Playlist not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#a31fc4" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{playlist.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Playlist Info */}
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName}>{playlist.name}</Text>
          <Text style={styles.playlistMeta}>
            {playlistSongs.length} songs • Created by {playlist.createdBy}
          </Text>
        </View>

        {/* Playlist Songs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Songs in Playlist</Text>
          {playlistSongs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes" size={48} color="#666" />
              <Text style={styles.emptyStateText}>No songs in this playlist yet</Text>
            </View>
          ) : (
            playlistSongs.map((song, index) => (
              <View key={song.id} style={[styles.songItem, index % 2 === 1 && styles.songItemAlt]}>
                <TouchableOpacity style={styles.songMain} onPress={() => playSong(song)}>
                  <View style={styles.songDetails}>
                    <Text style={styles.songTitle}>{song.title}</Text>
                    <Text style={styles.songArtist}>{song.artist}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeSongFromPlaylist(song.id)}
                >
                  <Ionicons name="remove-circle" size={24} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Search for Songs to Add */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add Songs</Text>
          </View>
          
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Recommended Songs */}
          {recommendedSongs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color="#666" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No songs found' : 'All songs are already in this playlist'}
              </Text>
            </View>
          ) : (
            recommendedSongs.map((song, index) => (
              <View key={song.id} style={[styles.songItem, index % 2 === 1 && styles.songItemAlt]}>
                <TouchableOpacity style={styles.songMain} onPress={() => playSong(song)}>
                  <View style={styles.songDetails}>
                    <Text style={styles.songTitle}>{song.title}</Text>
                    <Text style={styles.songArtist}>{song.artist}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => addSongToPlaylist(song)}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Toast */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        type={toastType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: StatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 2,
    paddingTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  playlistInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  playlistName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  playlistMeta: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    marginLeft: 8,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  songItemAlt: {
    backgroundColor: '#1a1a1a',
  },
  songMain: {
    flex: 1,
  },
  songDetails: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    padding: 8,
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#a31fc4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 