import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';

const REVEAL_MS = 3000;

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'> & {
  value: string;
  onChangeText: (text: string) => void;
};

export type PasswordInputHandle = {
  hideNow: () => void;
};

const PasswordInput = forwardRef<PasswordInputHandle, Props>(function PasswordInput(
  { value, onChangeText, ...rest },
  ref,
) {
  const [revealLast, setRevealLast] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    hideNow() {
      if (timerRef.current) clearTimeout(timerRef.current);
      setRevealLast(false);
    },
  }));

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(text: string) {
    onChangeText(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length > 0) {
      setRevealLast(true);
      timerRef.current = setTimeout(() => setRevealLast(false), REVEAL_MS);
    } else {
      setRevealLast(false);
    }
  }

  const masked = value.length === 0 ? '' : '•'.repeat(value.length - 1) + (revealLast ? value.slice(-1) : '•');

  return <TextInput {...rest} value={masked} onChangeText={handleChange} maxLength={15} />;
});

export default PasswordInput;
