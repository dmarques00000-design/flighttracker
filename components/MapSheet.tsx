import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

interface MapSheetProps {
  children: React.ReactNode;
  snapPoints?: string[];
  initialIndex?: number;
}

export function MapSheet({ children, snapPoints: customSnaps, initialIndex = 1 }: MapSheetProps) {
  const ref = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => customSnaps ?? ['15%', '45%', '92%'], [customSnaps]);

  return (
    <BottomSheet
      ref={ref}
      index={initialIndex}
      snapPoints={snapPoints}
      backgroundComponent={({ style }) => (
        <BlurView
          intensity={80}
          tint="systemMaterial"
          style={[style, styles.blurBackground]}
        />
      )}
      handleIndicatorStyle={styles.handle}
      animateOnMount
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  blurBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    backgroundColor: 'rgba(60,60,67,0.3)',
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  content: {
    paddingBottom: 40,
  },
});
