import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, error, clearError } = useAuth();
  const router = useRouter();

  // Show Firebase service error if present
  if (error && error.includes('Firebase')) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#ff4444" style={styles.errorIcon} />
          <Text style={styles.errorTitle}>🔥 Firebase Setup Required</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.instructionText}>
            Please enable Firebase services in Firebase Console:
          </Text>
          <Text style={styles.stepText}>1. Go to Firebase Console</Text>
          <Text style={styles.stepText}>2. Navigate to Authentication</Text>
          <Text style={styles.stepText}>3. Click "Get Started"</Text>
          <Text style={styles.stepText}>4. Enable Email/Password provider</Text>
          <Text style={styles.stepText}>5. Reload this app</Text>
          <TouchableOpacity style={styles.retryButton} onPress={clearError}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* App Title */}
        <View style={styles.headerSection}>
          <Text style={styles.appTitle}>SUNULU</Text>
        </View>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isLogin ? "current-password" : "new-password"}
        />
        
        {error && !error.includes('Firebase') && (
          <Text style={styles.localErrorText}>{error}</Text>
        )}
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => {
            setIsLogin(!isLogin);
            clearError();
          }}
        >
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
  },
  button: {
    backgroundColor: '#a31fc4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#555',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  switchText: {
    color: '#a31fc4',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#1a1a1a',
    padding: 30,
    borderRadius: 20,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: '#ff4444',
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  instructionText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  stepText: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 8,
    paddingLeft: 10,
  },
  retryButton: {
    backgroundColor: '#a31fc4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  localErrorText: {
    color: '#ff6666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
}); 