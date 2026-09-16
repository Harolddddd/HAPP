import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function PersonAvatar() {
  return (
    <View style={styles.badge}>
      <View style={styles.head} />
      <View style={styles.shoulders} />
    </View>
  );
}

const SIZE = 96;

const styles = StyleSheet.create({
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#e8eef2',
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  head: {
    position: 'absolute',
    top: 18,
    left: SIZE / 2 - 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b0bec5',
  },
  shoulders: {
    position: 'absolute',
    bottom: -30,
    left: SIZE / 2 - 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#b0bec5',
  },
});
