import React from 'react';
import { View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import Footer from './src/components/Footer';

export default function App() {
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <AppNavigator />
        </View>
        <Footer />
      </View>
    </AuthProvider>
  );
}
