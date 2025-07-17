import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
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
import { Toast, toastManager } from '../../components/Toast';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;


interface SharedPlaylist {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  songIds: string[];
}

export default function PlaylistsScreen() {
  const { user, username } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { queue, joinRoom, leaveRoom, currentRoom, participants } = useMusic();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<SharedPlaylist[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTranslateX = useState(new Animated.Value(-DRAWER_WIDTH))[0];

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

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

  // Listen to shared playlists from Firestore
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

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toastManager.showToast('Please enter a playlist name', 'error');
      return;
    }

    setCreating(true);
    try {
      await addDoc(collection(db as any, 'playlists'), {
        name: newPlaylistName.trim(),
        createdBy: user.email?.split('@')[0] || 'Unknown',
        createdAt: new Date(),
        songIds: [],
      });
      
      setNewPlaylistName('');
      setShowCreateModal(false);
      toastManager.showToast('Playlist created successfully!', 'success');
    } catch (error) {
      toastManager.showToast('Failed to create playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

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
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#a31fc4" />
          </TouchableOpacity>
        </View>

      {/* Main Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Playlists Section */}
        <View style={styles.playlistsSection}>
          
          {playlists.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes" size={48} color="#666" />
              <Text style={styles.emptyStateTitle}>No Playlists</Text>
              <Text style={styles.emptyStateText}>
                Create your first shared playlist to organize music with friends.
              </Text>
            </View>
          ) : (
            <View style={styles.playlistsList}>
              {playlists.map((playlist) => (
                <TouchableOpacity 
                  key={playlist.id} 
                  style={styles.playlistItem}
                  onPress={() => router.push(`/playlist/${playlist.id}`)}
                >
                  <View style={styles.playlistIcon}>
                    <Ionicons name="musical-notes" size={24} color="#a31fc4" />
                  </View>
                  <View style={styles.playlistDetails}>
                    <Text style={styles.playlistName}>{playlist.name}</Text>
                    <Text style={styles.playlistInfo}>
                      {playlist.songIds.length} songs • Created by {playlist.createdBy}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeDrawer}
        />
      )}

      {/* Drawer */}
      <Animated.View 
        style={[
          styles.drawer,
          {
            transform: [{ translateX: drawerTranslateX }],
          },
        ]}
      >
        {/* Drawer Header */}
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Sunulu</Text>
          <TouchableOpacity onPress={closeDrawer}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

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

          {/* Room Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sync Status</Text>
            <View style={styles.connectedRoom}>
              <View style={styles.roomInfo}>
                <Ionicons name="radio" size={20} color="#00ff88" />
                <Text style={styles.roomId}>Listening Room</Text>
              </View>
              <View style={styles.syncStatus}>
                <Text style={styles.syncStatusText}>Connected</Text>
              </View>
            </View>
          </View>

          {/* Participants Section */}
          {currentRoom && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Participants ({participants?.length || 1})</Text>
              <View style={styles.participantsList}>
                {/* Current user */}
                <View style={styles.participant}>
                  <View style={styles.participantAvatar}>
                    <Ionicons name="person" size={16} color="#a31fc4" />
                  </View>
                  <Text style={styles.participantName}>You</Text>
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostText}>HOST</Text>
                  </View>
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

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Playlist</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Playlist name..."
              placeholderTextColor="#666"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreatePlaylist}
                disabled={creating}
              >
                <Text style={styles.confirmButtonText}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 8,
  },
  createButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100, // Space for mini player
  },
  playlistsSection: {
    padding: 16,
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
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  playlistsList: {
    gap: 8,
  },
  drawerButton: {
    padding: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#1a1a1a',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 16,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  playlistDetails: {
    flex: 1,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 4,
  },
  playlistInfo: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#a31fc4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
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
}); 