import React from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';

const ICP_NUMBER = '滇ICP备2026018339号';
const ICP_URL = 'https://beian.miit.gov.cn/';

export default function Footer() {
  return (
    <View style={styles.container}>
      {Platform.OS === 'web'
        ? React.createElement(
            'a',
            {
              href: ICP_URL,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { color: '#888', fontSize: 12, textDecoration: 'none' },
            },
            ICP_NUMBER
          )
        : (
            <Text style={styles.link} onPress={() => Linking.openURL(ICP_URL)}>
              {ICP_NUMBER}
            </Text>
          )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8, alignItems: 'center' },
  link: { color: '#888', fontSize: 12 },
});
