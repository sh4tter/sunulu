import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useMusic } from '../contexts/MusicContext';

const { width, height } = Dimensions.get('window');
const MINI_PLAYER_HEIGHT = 80;
const EXPANDED_PLAYER_HEIGHT = height * 0.9;

interface MiniPlayerProps {
  onSearchPress: () => void;
}

export default function MiniPlayer({ onSearchPress }: MiniPlayerProps) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    queue,
    playlists,
    playSong,
    pauseSong,
    resumeSong,
    skipNext,
    skipPrevious,
    seekTo,
    addToQueue,
    removeFromQueue,
    createPlaylist,
    currentRoom,
    participants,
    isShuffleEnabled,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    likeSong,
    getCurrentSongLikes,
    setSongMood,
    getCurrentSongMood,
  } = useMusic();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'playlists'>('queue');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLikeHeart, setShowLikeHeart] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMoodSelector, setShowMoodSelector] = useState(false);

  const animatedHeight = useState(new Animated.Value(MINI_PLAYER_HEIGHT))[0];
  const popupOpacity = useState(new Animated.Value(0))[0];
  const popupScale = useState(new Animated.Value(0.1))[0];
  const popupWidth = useState(new Animated.Value(60))[0];
  const animatedOpacity = useState(new Animated.Value(0))[0];
  const likeHeartOpacity = useState(new Animated.Value(0))[0];
  const likeHeartScale = useState(new Animated.Value(0.5))[0];
  const translateY = useState(new Animated.Value(0))[0];
  const lastTap = useRef<number | null>(null);
  const panGestureRef = useRef(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (lastTap.current && (now - lastTap.current) < DOUBLE_TAP_DELAY) {
      // Double tap detected - reset the timer to prevent triple tap
      lastTap.current = null;
      
      if (currentSong && currentRoom) {
        likeSong(currentSong);
        
        // Show like heart animation immediately
        setShowLikeHeart(true);
        likeHeartOpacity.setValue(0);
        likeHeartScale.setValue(0.5);
        
        Animated.parallel([
          Animated.timing(likeHeartOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(likeHeartScale, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Fade out after showing
          Animated.parallel([
            Animated.timing(likeHeartOpacity, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(likeHeartScale, {
              toValue: 0.5,
              duration: 800,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShowLikeHeart(false);
          });
        });
      }
    } else {
      // First tap - start the timer
      lastTap.current = now;
      
      // Clear any existing timeout to prevent delayed single tap actions
      setTimeout(() => {
        if (lastTap.current === now) {
          // This was a single tap, not followed by a second tap
          lastTap.current = null;
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const getCurrentLikesForDisplay = () => {
    if (!currentSong || !currentRoom) return [];
    
    const likes = getCurrentSongLikes();
    // Show likes from other users only
    return likes.filter(like => like.userId !== participants.find(p => p.email)?.id);
  };

  const getTotalLikeCount = () => {
    if (!currentSong || !currentRoom) return 0;
    return getCurrentSongLikes().length;
  };

  const expandPlayer = () => {
    setIsExpanded(true);
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: EXPANDED_PLAYER_HEIGHT,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const showMoodPopup = () => {
    setShowMoodSelector(true);
    Animated.parallel([
      Animated.timing(popupOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.spring(popupScale, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: false,
      }),
      Animated.spring(popupWidth, {
        toValue: width - 32,
        tension: 80,
        friction: 6,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const hideMoodPopup = () => {
    Animated.parallel([
      Animated.timing(popupOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.spring(popupScale, {
        toValue: 0.1,
        tension: 80,
        friction: 6,
        useNativeDriver: false,
      }),
      Animated.spring(popupWidth, {
        toValue: 60,
        tension: 80,
        friction: 6,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setShowMoodSelector(false);
    });
  };

  const collapsePlayer = () => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: MINI_PLAYER_HEIGHT,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsExpanded(false);
    });
  };

  const handlePanGesture = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { velocityY, translationY } = event.nativeEvent;
      
      if (velocityY > 500 || translationY > 100) {
        // Swipe down - collapse
        if (isExpanded) {
          collapsePlayer();
        }
      } else if (velocityY < -500 || translationY < -100) {
        // Swipe up - expand
        if (!isExpanded) {
          expandPlayer();
        }
      }
    }
  };

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName);
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
    }
  };

  const handleSeekGesture = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      setIsDragging(true);
    } else if (event.nativeEvent.state === State.ACTIVE) {
      const { x } = event.nativeEvent;
      const progressBarWidth = width - 32; // Account for padding
      const progress = Math.max(0, Math.min(1, x / progressBarWidth));
      const newTime = progress * duration;
      
      if (duration > 0) {
        seekTo(newTime);
      }
    } else if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      setIsDragging(false);
    }
  };

  const filteredQueue = queue.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPlaylists = playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentSong) {
    return (
      <View style={styles.placeholderContainer}>
        <TouchableOpacity
          style={styles.placeholder}
          onPress={expandPlayer}
          activeOpacity={0.8}
        >
          <Ionicons name="musical-notes" size={20} color="#666" />
          <Text style={styles.placeholderText}>Nothing playing – tap to open player</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <PanGestureHandler onHandlerStateChange={handlePanGesture}>
        <Animated.View style={[styles.miniPlayer, { height: animatedHeight }]}>
          {/* Mini Player Header */}
          <TouchableOpacity
            style={[styles.miniPlayerHeader, { height: isExpanded ? 0 : MINI_PLAYER_HEIGHT }]}
            onPress={isExpanded ? collapsePlayer : expandPlayer}
            activeOpacity={0.8}
          >
            {!isExpanded && (
              <>
                <View style={styles.dragHandle} />
                <View style={styles.miniPlayerContent}>
                  <View style={styles.songInfo}>
                    {currentSong.albumArt ? (
                      <Image source={{ uri: currentSong.albumArt }} style={styles.miniAlbumArt} />
                    ) : (
                      <View style={styles.miniAlbumArtPlaceholder}>
                        <Ionicons name="musical-note" size={20} color="#666" />
                      </View>
                    )}
                    <View style={styles.miniSongText}>
                      <Text style={styles.miniSongTitle} numberOfLines={1}>
                        {currentSong.title}
                      </Text>
                      <Text style={styles.miniSongArtist} numberOfLines={1}>
                        {currentSong.artist}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.miniControls}>
                    <TouchableOpacity
                      onPress={isPlaying ? pauseSong : resumeSong}
                      style={styles.playPauseButton}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={24}
                        color="#a31fc4"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Progress bar for mini player */}
          {!isExpanded && (
            <View style={styles.miniProgressContainer}>
              <View style={styles.miniProgressBar}>
                <View
                  style={[
                    styles.miniProgress,
                    { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Expanded Player Content */}
          <Animated.View style={[styles.expandedContent, { opacity: animatedOpacity }]}>
            {isExpanded && (
              <>
                <View style={styles.expandedHeader}>
                  <TouchableOpacity onPress={collapsePlayer} style={styles.collapseButton}>
                    <Ionicons name="chevron-down" size={24} color="#a31fc4" />
                  </TouchableOpacity>
                </View>

                {/* Now Playing Section - Full Width Album Art */}
                <View style={styles.currentSongSection}>
                  <TouchableWithoutFeedback 
                    onPress={handleDoubleTap}
                    delayLongPress={500}
                    delayPressIn={0}
                    delayPressOut={0}
                  >
                    <View style={styles.albumArtContainer}>
                      {/* Like Heart Visual */}
                      {showLikeHeart && (
                        <Animated.View 
                          style={[
                            styles.likeHeartOverlay,
                            {
                              opacity: likeHeartOpacity,
                              transform: [{ scale: likeHeartScale }],
                            }
                          ]}
                        >
                          <Ionicons name="heart" size={40} color="#ffffff" />
                        </Animated.View>
                      )}
                      
                      {currentSong.albumArt ? (
                        <Image source={{ uri: currentSong.albumArt }} style={styles.fullWidthAlbumArt} />
                      ) : (
                        <View style={styles.fullWidthAlbumArtPlaceholder}>
                          <Ionicons name="musical-notes" size={80} color="#666" />
                        </View>
                      )}
                      
                      {/* Like Counter at Bottom */}
                      {getTotalLikeCount() > 0 && (
                        <View style={styles.likeCounterContainer}>
                          <Ionicons name="heart" size={16} color="#FF6B6B" />
                          <Text style={styles.likeCounterText}>{getTotalLikeCount()}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                  
                                      {/* Mood Panel */}
                    <View style={styles.moodPanel}>
                      <Text style={styles.moodLabel}>vibe?</Text>
                      <View style={styles.moodContainer}>
                        {getCurrentSongMood() ? (
                          <TouchableOpacity 
                            style={styles.moodDisplay}
                            onPress={showMoodPopup}
                          >
                            <Text style={styles.moodEmojiDisplay}>
                              {getCurrentSongMood()?.mood === 'love' ? '❤️' : 
                               getCurrentSongMood()?.mood === 'party' ? '🎉' : 
                               getCurrentSongMood()?.mood === 'kiss' ? '😘' :
                               getCurrentSongMood()?.mood === 'thumbsup' ? '👍' :
                               getCurrentSongMood()?.mood === 'thumbsdown' ? '👎' :
                               getCurrentSongMood()?.mood === 'puke' ? '🤮' :
                               getCurrentSongMood()?.mood === 'crying' ? '😢' : '❤️'}
                            </Text>
                            <Text style={styles.moodUserText}>
                              {getCurrentSongMood()?.userName}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.moodSelector} onPress={showMoodPopup}>
                            <Ionicons name="add-circle-outline" size={20} color="#666" />
                          </TouchableOpacity>
                        )}
                        
                        {/* Mood Popup */}
                        {showMoodSelector && (
                          <Animated.View 
                            style={[
                              styles.moodPopup,
                              {
                                opacity: popupOpacity,
                                width: popupWidth,
                                transform: [
                                  { translateX: Animated.multiply(popupWidth, -0.5) },
                                  { scale: popupScale }
                                ],
                              }
                            ]}
                          >
                            <TouchableOpacity 
                              style={styles.moodPopupButton} 
                              onPress={() => {
                                console.log('Setting mood: love for song:', currentSong.title);
                                setSongMood(currentSong, 'love');
                                hideMoodPopup();
                              }}
                            >
                              <Text style={styles.moodPopupEmoji}>❤️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.moodPopupButton} 
                              onPress={() => {
                                setSongMood(currentSong, 'kiss');
                                hideMoodPopup();
                              }}
                            >
                              <Text style={styles.moodPopupEmoji}>😘</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.moodPopupButton} 
                              onPress={() => {
                                setSongMood(currentSong, 'thumbsup');
                                hideMoodPopup();
                              }}
                            >
                              <Text style={styles.moodPopupEmoji}>👍</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.moodPopupButton} 
                              onPress={() => {
                                setSongMood(currentSong, 'thumbsdown');
                                hideMoodPopup();
                              }}
                            >
                              <Text style={styles.moodPopupEmoji}>👎</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.moodPopupButton} 
                              onPress={() => {
                                setSongMood(currentSong, 'puke');
                                hideMoodPopup();
                              }}
                            >
                              <Text style={styles.moodPopupEmoji}>🤮</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.moodPopupButton} 
                              onPress={() => {
                                setSongMood(currentSong, 'crying');
                                hideMoodPopup();
                              }}
                            >
                              <Text style={styles.moodPopupEmoji}>😢</Text>
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </View>
                    </View>
                </View>

                {/* Bottom Controls Section */}
                <View style={styles.bottomControlsSection}>
                  <Text style={styles.expandedSongTitle}>{currentSong.title}</Text>
                  <Text style={styles.expandedSongArtist}>{currentSong.artist}</Text>

                  {/* Likes Display */}
                  {getCurrentLikesForDisplay().length > 0 && (
                    <View style={styles.likesContainer}>
                      {getCurrentLikesForDisplay().map((like, index) => (
                        <View key={`${like.userId}-${like.timestamp}`} style={styles.likeItem}>
                          <Ionicons name="heart" size={16} color="#FF6B6B" />
                          <Text style={styles.likeText}>{like.userName}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Progress Section */}
                  <View style={styles.progressSection}>
                    <PanGestureHandler
                      ref={panGestureRef}
                      onGestureEvent={handleSeekGesture}
                      onHandlerStateChange={handleSeekGesture}
                    >
                      <Animated.View style={styles.progressBarContainer}>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progress,
                              { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` },
                            ]}
                          />
                          <View
                            style={[
                              styles.progressThumb,
                              {
                                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                                opacity: isDragging ? 1 : 0.7,
                                transform: [{ scale: isDragging ? 1.2 : 1 }],
                              },
                            ]}
                          />
                        </View>
                      </Animated.View>
                    </PanGestureHandler>
                    <View style={styles.timeLabels}>
                      <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                      <Text style={styles.timeText}>{formatTime(duration)}</Text>
                    </View>
                  </View>

                  {/* Player Controls */}
                  <View style={styles.playerControls}>
                    <TouchableOpacity onPress={toggleShuffle}>
                      <Ionicons 
                        name="shuffle" 
                        size={24} 
                        color={isShuffleEnabled ? "#a31fc4" : "#666"} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={skipPrevious}>
                      <Ionicons name="play-skip-back" size={30} color="#a31fc4" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={isPlaying ? pauseSong : resumeSong}
                      style={styles.playButton}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={40}
                        color="#ffffff"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={skipNext}>
                      <Ionicons name="play-skip-forward" size={30} color="#a31fc4" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleRepeat}>
                      <Ionicons 
                        name={repeatMode === 'one' ? "repeat-outline" : "repeat"} 
                        size={24} 
                        color={repeatMode !== 'off' ? "#a31fc4" : "#666"} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>


    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  miniPlayer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  miniPlayerHeader: {
    height: MINI_PLAYER_HEIGHT,
    flexDirection: 'column',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    flex: 1,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  miniAlbumArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  miniAlbumArtPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  miniSongText: {
    flex: 1,
  },
  miniSongTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  miniSongArtist: {
    color: '#999',
    fontSize: 12,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playPauseButton: {
    padding: 8,
  },
  miniProgressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  miniProgressBar: {
    flex: 1,
    backgroundColor: '#333',
  },
  miniProgress: {
    height: '100%',
    backgroundColor: '#a31fc4',
  },
  expandedContent: {
    flex: 1,
    paddingTop: 8,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 4,
    paddingTop: 8,
  },
  expandedTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  currentSongSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  albumArtContainer: {
    position: 'relative',
    width: '100%',
  },
  fullWidthAlbumArt: {
    width: '100%',
    height: 300,
    borderRadius: 0,
    marginBottom: 20,
  },
  fullWidthAlbumArtPlaceholder: {
    width: '100%',
    height: 300,
    borderRadius: 0,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  expandedSongTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  expandedSongArtist: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  progressSection: {
    width: '100%',
    marginBottom: 24,
  },
  progressBarContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progress: {
    height: '100%',
    backgroundColor: '#a31fc4',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -8,
    left: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#a31fc4',
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: '#999',
    fontSize: 12,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#a31fc4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholder: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    marginLeft: 8,
  },
  bottomControlsSection: {
    width: '100%',
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  likeText: {
    color: '#999',
    fontSize: 12,
  },
  likeHeartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeCounterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeCounterText: {
    color: '#ffffff',
    fontSize: 12,
  },
  collapseButton: {
    padding: 8,
  },
  moodPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
    alignSelf: 'center',
  },
  moodLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 4,
  },
  moodEmojiDisplay: {
    fontSize: 18,
  },
  moodSelector: {
    padding: 4,
  },
  moodUserText: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  moodContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  moodPopup: {
    position: 'absolute',
    bottom: 35,
    left: '50%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 1001,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  moodPopupButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  moodPopupEmoji: {
    fontSize: 24,
  },
}); 