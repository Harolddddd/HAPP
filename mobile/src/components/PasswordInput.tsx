import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'> & {
  value: string;
  onChangeText: (text: string) => void;
};

export default function PasswordInput({ value, onChangeText, ...rest }: Props) {
  const masked = value.length === 0 ? '' : '•'.repeat(value.length - 1) + value.slice(-1);

  return <TextInput {...rest} value={masked} onChangeText={onChangeText} maxLength={15} />;
}
