import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import EditUsernameModal from '../../components/EditUsernameModal';
import MiniPlayer from '../../components/MiniPlayer';
import { Toast, toastManager } from '../../components/Toast';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';

interface SharedPlaylist {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  songIds: string[];
}

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

export default function MusicPlayerScreen() {
  const {
    currentSong,
    isPlaying,
    queue,
    playSong,
    joinRoom,
    leaveRoom,
    currentRoom,
    loadSongsFromStorage,
    refreshSongsFromServer,
    participants,
  } = useMusic();
  
  const { user, logout, username } = useAuth();
  const router = useRouter();
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTranslateX = useState(new Animated.Value(-DRAWER_WIDTH))[0];
  
  // Search and modal states
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadAnimation] = useState(new Animated.Value(0));

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  // Playlist selection state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [playlists, setPlaylists] = useState<SharedPlaylist[]>([]);

  // Username edit modal state
  const [showEditUsernameModal, setShowEditUsernameModal] = useState(false);

  // Setup toast manager
  useEffect(() => {
    toastManager.setShowToastCallback((message, type = 'info') => {
      setToastMessage(message);
      setToastType(type);
      setToastVisible(true);
    });
  }, []);

  // Start reload animation when loading songs
  useEffect(() => {
    if (loadingSongs) {
      const animation = Animated.loop(
        Animated.timing(reloadAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      reloadAnimation.setValue(0);
    }
  }, [loadingSongs]);

  // Load playlists from Firestore
  useEffect(() => {
    if (!user) return;
    
    const playlistsRef = collection(db as any, 'playlists');
    const q = query(playlistsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playlistData: SharedPlaylist[] = [];
      snapshot.forEach((doc) => {
        playlistData.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as SharedPlaylist);
      });
      setPlaylists(playlistData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load songs from Firebase Storage on component mount
  useEffect(() => {
    if (user) {
      setLoadingSongs(true);
      loadSongsFromStorage().finally(() => {
        setLoadingSongs(false);
      });
    }
  }, [user]);

  // Removed auto-play - users should choose which song to play

  // Add song to playlist function
  const addSongToPlaylist = async (playlistId: string, song: any) => {
    try {
      await updateDoc(doc(db as any, 'playlists', playlistId), {
        songIds: arrayUnion(song.id),
      });
      toastManager.showToast('Song added to playlist!', 'success');
      setShowPlaylistModal(false);
      setSelectedSong(null);
    } catch (error) {
      toastManager.showToast('Failed to add song to playlist', 'error');
    }
  };

  // Handle long press on song
  const handleSongLongPress = (song: any) => {
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  // If user data not yet available, avoid rendering until root navigator handles it
  if (!user) {
    return null;
  }

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerTranslateX, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerTranslateX, {
      toValue: -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDrawerOpen(false);
    });
  };

  const handleJoinRoom = async () => {
    if (roomId.trim()) {
      try {
        await joinRoom(roomId);
        setShowRoomModal(false);
        setRoomId('');
        toastManager.showToast('Joined room successfully!', 'success');
      } catch (error) {
        toastManager.showToast('Failed to join room', 'error');
      }
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
      toastManager.showToast('Left room successfully!', 'success');
    } catch (error) {
      toastManager.showToast('Failed to leave room', 'error');
    }
  };

  const handleSearchPress = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setSearchQuery('');
    }
  };

  const handleRefreshSongs = async () => {
    if (!user) {
      toastManager.showToast('Please log in to load songs', 'error');
      return;
    }
    
    setRefreshing(true);
    try {
      await refreshSongsFromServer();
      toastManager.showToast('Songs refreshed successfully!', 'success');
    } catch (error) {
      toastManager.showToast('Failed to refresh songs. Please try again.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredQueue = queue.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderDrawerContent = () => (
    <Animated.View 
      style={[
        styles.drawer,
        {
          transform: [{ translateX: drawerTranslateX }],
        },
      ]}
    >
      <ScrollView style={styles.drawerContent}>
        {/* User Info */}
        <TouchableOpacity 
          style={styles.userSection} 
          onPress={() => setShowEditUsernameModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={30} color="#a31fc4" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {username || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.editHint}>Tap to edit username</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Connected Status */}
        <View style={styles.section}>
          <View style={styles.connectedRoom}>
            <View style={styles.roomInfo}>
              <Ionicons name="radio" size={20} color="#00ff88" />
              <Text style={styles.roomId}>Connected</Text>
            </View>
          </View>
        </View>

        {/* Participants List */}
        {currentRoom && (
          <View style={styles.section}>
            <View style={styles.participantsList}>
              {/* Current user */}
              <View style={styles.participant}>
                <View style={styles.participantAvatar}>
                  <Ionicons name="person" size={16} color="#a31fc4" />
                </View>
                <Text style={styles.participantName}>
                  {username || user?.email?.split('@')[0] || 'User'}
                </Text>
              </View>
              
              {/* Other participants */}
              {participants?.map((participant, index) => (
                <View key={index} style={styles.participant}>
                  <View style={styles.participantAvatar}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                  <Text style={styles.participantName}>{participant.email?.split('@')[0] || `User ${index + 1}`}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={openDrawer} style={styles.drawerButton}>
            <Ionicons name="menu" size={24} color="#a31fc4" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SUNULU</Text>
          <TouchableOpacity onPress={handleSearchPress} style={styles.headerSearchButton}>
            <Ionicons name="search" size={24} color="#a31fc4" />
          </TouchableOpacity>
        </View>

        {/* Inline Search Box */}
        {showSearch && (
          <View style={styles.searchBox}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search songs, artists..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Main Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefreshSongs}
            />
          }
        >

          {/* Available Songs */}
          <View style={styles.songsSection}>
            
            {loadingSongs ? (
              <View style={styles.emptyState}>
                <Animated.View style={[styles.reloadAnimation, {
                  transform: [{
                    rotate: reloadAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }]}>
                  <Ionicons name="refresh" size={64} color="#a31fc4" />
                </Animated.View>
                <Text style={styles.emptyStateTitle}>Loading Songs...</Text>
                <Text style={styles.emptyStateText}>
                  Please wait while we load your music library.
                </Text>
              </View>
            ) : queue.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.shimmerRow}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <View key={i} style={styles.shimmerBlock} />
                  ))}
                </View>
                <Text style={styles.emptyStateTitle}>No Songs Available</Text>
                <Text style={styles.emptyStateText}>
                  {!user ? 'Please log in to access your music library.' : 'Add songs to Firebase Storage to see them here.'}
                </Text>
              </View>
            ) : filteredQueue.length === 0 && searchQuery.length > 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={40} color="#666" />
                <Text style={styles.emptyStateTitle}>No Songs Found</Text>
                <Text style={styles.emptyStateText}>
                  No songs match &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : (
              <View style={styles.songsList}>
                {filteredQueue.map((song, index) => (
                  <TouchableOpacity
                    key={song.id}
                    style={[
                      styles.songItem,
                      index % 2 === 0 ? styles.songItemAlt : null,
                      currentSong?.id === song.id && styles.currentSongItem,
                    ]}
                    onPress={() => playSong(song)}
                    onLongPress={() => handleSongLongPress(song)}
                  >
                    {song.albumArt ? (
                      <Image source={{ uri: song.albumArt }} style={styles.songAlbumArt} />
                    ) : (
                      <View style={styles.songAlbumArtPlaceholder}>
                        <Ionicons name="musical-note" size={24} color="#666" />
                      </View>
                    )}
                    <View style={styles.songDetails}>
                      <Text style={styles.songTitle} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={styles.songArtist} numberOfLines={1}>
                        {song.artist}
                      </Text>
                    </View>
                    <View style={styles.songActions}>
                      {currentSong?.id === song.id && isPlaying && (
                        <View style={styles.playingIndicator}>
                          <Ionicons name="volume-high" size={20} color="#a31fc4" />
                        </View>
                      )}
                      <TouchableOpacity style={styles.moreButton}>
                        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Mini Player */}
        <MiniPlayer onSearchPress={handleSearchPress} />

        {/* Drawer Overlay */}
        {drawerOpen && (
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={closeDrawer}
          />
        )}

        {/* Drawer */}
        {renderDrawerContent()}





        {/* Playlist Selection Modal */}
        <Modal
          visible={showPlaylistModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPlaylistModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Add to Playlist</Text>
              <Text style={styles.modalSubtitle}>
                {selectedSong ? `"${selectedSong.title}" by ${selectedSong.artist}` : ''}
              </Text>
              
              <ScrollView style={styles.playlistsList}>
                {playlists.length === 0 ? (
                  <View style={styles.emptyPlaylistState}>
                    <Text style={styles.emptyPlaylistText}>No playlists available</Text>
                    <Text style={styles.emptyPlaylistSubtext}>Create a playlist first in the Playlists tab</Text>
                  </View>
                ) : (
                  playlists.map((playlist) => (
                    <TouchableOpacity
                      key={playlist.id}
                      style={[
                        styles.playlistOption,
                        selectedSong && playlist.songIds.includes(selectedSong.id) && styles.playlistAlreadyAdded,
                      ]}
                      onPress={() => selectedSong && addSongToPlaylist(playlist.id, selectedSong)}
                      disabled={selectedSong && playlist.songIds.includes(selectedSong.id)}
                    >
                      <View style={styles.playlistOptionIcon}>
                        <Ionicons name="musical-notes" size={20} color="#a31fc4" />
                      </View>
                      <View style={styles.playlistOptionDetails}>
                        <Text style={styles.playlistOptionName}>{playlist.name}</Text>
                        <Text style={styles.playlistOptionCount}>
                          {playlist.songIds.length} songs • {playlist.createdBy}
                        </Text>
                      </View>
                      {selectedSong && playlist.songIds.includes(selectedSong.id) && (
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowPlaylistModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Username Modal */}
        <EditUsernameModal
          visible={showEditUsernameModal}
          onClose={() => setShowEditUsernameModal(false)}
          currentUsername={username}
        />

        {/* Toast */}
        <Toast
          message={toastMessage}
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
          type={toastType}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: StatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginTop: -20,
    backgroundColor: '#000',
  },
  drawerButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 8,
  },
  headerSearchButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100, // Space for mini player
  },
  songsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  songsList: {
    gap: 8,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0f0f0f',
  },
  currentSongItem: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  songAlbumArt: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  songAlbumArtPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  songDetails: {
    flex: 1,
  },
  songTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  songArtist: {
    color: '#999',
    fontSize: 14,
  },
  songActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playingIndicator: {
    padding: 4,
  },
  moreButton: {
    padding: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: height, // Use screen height to cover entire screen
    backgroundColor: '#1a1a1a',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 9999,
    // Ensure it covers everything including status bar and tabs
    paddingTop: 50, // Add padding for status bar
    paddingBottom: 100, // Add padding for bottom tabs
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  drawerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  drawerContent: {
    flex: 1,
    padding: 20,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: '#666',
    fontSize: 14,
  },
  editHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  connectedRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roomId: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  leaveButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  leaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  syncStatus: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncStatusText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  joinRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
  },
  joinRoomText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  participantsList: {
    gap: 12,
  },
  participant: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  participantName: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  hostBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hostText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    margin: 16,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    width: width - 64,
    maxWidth: 320,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#333',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  joinButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
  },
  libraryText: {
    color: '#a31fc4',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  loadingIcon: {
    marginBottom: 16,
  },
  shimmerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  shimmerBlock: {
    width: '30%',
    height: 100,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionSearchButton: {
    padding: 8,
  },
  songItemAlt: {
    backgroundColor: '#1a1a1a',
  },
  modalSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  playlistsList: {
    flex: 1,
    padding: 16,
  },
  emptyPlaylistState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPlaylistText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyPlaylistSubtext: {
    color: '#666',
    fontSize: 14,
  },
  playlistOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  playlistOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playlistOptionDetails: {
    flex: 1,
  },
  playlistOptionName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  playlistOptionCount: {
    color: '#999',
    fontSize: 14,
  },
  playlistAlreadyAdded: {
    backgroundColor: '#333',
  },
  reloadAnimation: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
