import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Adjust width dynamically for better responsiveness on web
const SLIDER_WIDTH = Math.min(SCREEN_WIDTH - 60, 400); 
const KNOB_SIZE = 50;
const END_POSITION = SLIDER_WIDTH - KNOB_SIZE - 10;

interface VelocitySliderProps {
  onComplete: () => void;
  text: string;
  color?: string;
}

export default function VelocitySlider({ onComplete, text, color = '#02844F' }: VelocitySliderProps) {
  const translateX = useSharedValue(0);
  const context = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateX.value;
    })
    .onUpdate((event) => {
      let nextX = context.value + event.translationX;
      if (nextX < 0) nextX = 0;
      if (nextX > END_POSITION) nextX = END_POSITION;
      translateX.value = nextX;
    })
    .onEnd(() => {
      if (translateX.value > END_POSITION * 0.8) {
        translateX.value = withSpring(END_POSITION);
        runOnJS(onComplete)();
      } else {
        translateX.value = withSpring(0);
      }
    })
    .activeOffsetX([-10, 10]); // Critical for web/mouse reliability

  const animatedKnobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: translateX.value + KNOB_SIZE + 5,
    backgroundColor: interpolate(
      translateX.value,
      [0, END_POSITION],
      ['#000000', color]
    ),
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, END_POSITION / 2],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <View style={[styles.container, { width: SLIDER_WIDTH }]}>
      <Animated.View style={[styles.progressTrack, animatedProgressStyle]} />
      
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.knob, animatedKnobStyle]}>
          <ChevronRight color="#fff" size={24} />
        </Animated.View>
      </GestureDetector>

      <Animated.Text style={[styles.text, animatedTextStyle]}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    paddingHorizontal: 5,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.8,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    cursor: 'pointer', // UX enhancement for web
  },
  text: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    zIndex: 0,
    userSelect: 'none', // Prevent text highlighting on web
  },
});
