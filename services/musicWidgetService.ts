// @ts-nocheck
// services/musicWidgetService.ts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Minimal subset of Song type used within this file
export interface MiniSong {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number;
}

const MUSIC_WIDGET_CHANNEL_ID = 'music-widget';
let widgetNotificationId: string | undefined;
let lastWidgetState = {
  songId: '',
  isPlaying: false,
  position: 0,
  vibe: '',
};

// Simple permission check (only once)
let permissionsChecked = false;
async function ensureNotificationPermissions() {
  if (Platform.OS !== 'android') return true;
  if (permissionsChecked) return true;
  
  const { status } = await Notifications.getPermissionsAsync();
  permissionsChecked = true;
  
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === 'granted';
  }
  
  return true;
}

async function ensureMusicWidgetChannel() {
  if (Platform.OS !== 'android') return;
  
  await Notifications.setNotificationChannelAsync(MUSIC_WIDGET_CHANNEL_ID, {
    name: 'Music Widget',
    importance: Notifications.AndroidImportance.HIGH, // HIGH for media notifications to appear prominently
    sound: null,
    vibrationPattern: [0],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
    enableVibrate: false,
    enableLights: false,
  });
}

async function ensureMusicWidgetCategory() {
  await Notifications.setNotificationCategoryAsync('musicWidgetControls', [
    { identifier: 'REWIND', buttonTitle: '⏪' },
    { identifier: 'PAUSE', buttonTitle: '⏸️' },
    { identifier: 'PLAY', buttonTitle: '▶️' },
    { identifier: 'FORWARD', buttonTitle: '⏩' },
  ]);
}

// Check if widget update is needed (debounced)
function shouldUpdateWidget(
  song: MiniSong,
  isPlaying: boolean,
  positionSec: number,
  vibe?: string,
): boolean {
  const currentState = {
    songId: song.id,
    isPlaying,
    position: Math.floor(positionSec / 5) * 5, // Round to 5-second intervals
    vibe: vibe || '',
  };

  // Update if song changed, play state changed, or vibe changed
  const hasChanged = 
    currentState.songId !== lastWidgetState.songId ||
    currentState.isPlaying !== lastWidgetState.isPlaying ||
    currentState.vibe !== lastWidgetState.vibe;

  if (hasChanged) {
    lastWidgetState = currentState;
  }

  return hasChanged;
}

export async function showOrUpdateMusicWidget(
  song: MiniSong,
  isPlaying: boolean,
  positionSec: number,
  vibe?: string,
) {
  try {
    // Always show widget when song changes or play state changes
    const shouldShow = shouldUpdateWidget(song, isPlaying, positionSec, vibe) || !widgetNotificationId;
    
    if (!shouldShow) {
      return;
    }

    // Check permissions once
    const hasPermissions = await ensureNotificationPermissions();
    if (!hasPermissions) {
      console.log('❌ Cannot show music widget - no permissions');
      return;
    }

    await ensureMusicWidgetChannel();
    await ensureMusicWidgetCategory();

    // Build actions – show play *or* pause depending on state
    const widgetActions = [
      { identifier: 'REWIND', buttonTitle: '⏪' },
      isPlaying
        ? { identifier: 'PAUSE', buttonTitle: '⏸️' }
        : { identifier: 'PLAY', buttonTitle: '▶️' },
      { identifier: 'FORWARD', buttonTitle: '⏩' },
    ];

    // Format time for display
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentTime = formatTime(positionSec);
    const totalTime = formatTime(song.duration);

    const content = {
      title: song.title,
      subtitle: song.artist,
      body: `${currentTime}/${totalTime}${vibe ? ` • ${vibe}` : ''}`,
      sticky: true,
      categoryIdentifier: 'musicWidgetControls',
      android: {
        channelId: MUSIC_WIDGET_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        color: '#a31fc4',
        // Large media notification style like YouTube Music
        style: {
          type: 'media',
          title: song.title,
          subtitle: song.artist,
          description: `${currentTime}/${totalTime}${vibe ? ` • ${vibe}` : ''}`,
        },
        // Progress bar showing current position
        progress: {
          maxProgress: song.duration || 1,
          current: Math.floor(positionSec),
          indeterminate: false,
        },
        actions: widgetActions as any,
        // Make it appear prominently at top
        priority: 'high', // HIGH priority for prominent display
        visibility: 'public',
        // Large icon for album art if available
        largeIcon: song.albumArt || undefined,
        // Small icon for the app
        smallIcon: 'ic_launcher',
        // Show as media notification
        showWhen: false,
        // Keep visible when playing
        autoCancel: !isPlaying,
        // Make it prominent like the image
        importance: 'high',
      },
      data: {
        songId: song.id,
        isPlaying,
        position: positionSec,
      },
    };

    // Replace existing widget if it exists
    if (widgetNotificationId) {
      try {
        await Notifications.dismissNotificationAsync(widgetNotificationId);
      } catch (e) {
        // Silent error handling
      }
    }

    widgetNotificationId = await Notifications.scheduleNotificationAsync({
      content: content as any,
      trigger: null,
    });

    console.log('✅ Music widget shown:', {
      song: song.title,
      isPlaying,
      position: currentTime,
    });

  } catch (error) {
    console.error('❌ Music widget error:', error);
  }
}

export async function clearMusicWidget() {
  if (widgetNotificationId) {
    try {
      await Notifications.dismissNotificationAsync(widgetNotificationId);
    } catch (e) {
      // Silent error handling
    }
    widgetNotificationId = undefined;
    // Reset state tracking
    lastWidgetState = {
      songId: '',
      isPlaying: false,
      position: 0,
      vibe: '',
    };
  }
}

export async function updateMusicWidgetProgress(
  song: MiniSong,
  isPlaying: boolean,
  positionSec: number,
  vibe?: string,
) {
  await showOrUpdateMusicWidget(song, isPlaying, positionSec, vibe);
} 