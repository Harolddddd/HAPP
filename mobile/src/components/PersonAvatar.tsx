import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function PersonAvatar({ size = 96, style }: Props) {
  const headSize = size * 0.417;
  const shouldersSize = size * 0.833;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#e8eef2',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.1875,
          left: (size - headSize) / 2,
          width: headSize,
          height: headSize,
          borderRadius: headSize / 2,
          backgroundColor: '#b0bec5',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -size * 0.3125,
          left: (size - shouldersSize) / 2,
          width: shouldersSize,
          height: shouldersSize,
          borderRadius: shouldersSize / 2,
          backgroundColor: '#b0bec5',
        }}
      />
    </View>
  );
}
