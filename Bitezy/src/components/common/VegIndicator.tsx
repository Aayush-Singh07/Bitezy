import React from 'react';
import { View, StyleSheet } from 'react-native';

const VegIndicator = ({ isVeg, size = 16 }: { isVeg: boolean; size?: number }) => {
  const color = isVeg ? '#02844F' : '#B42318';
  return (
    <View style={[styles.indicatorBox, { borderColor: color, width: size, height: size }]}>
      <View style={[styles.indicatorDot, { backgroundColor: color, width: size * 0.45, height: size * 0.45 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  indicatorBox: { 
    borderWidth: 1.5, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 2,
    backgroundColor: '#FFF'
  },
  indicatorDot: { 
    borderRadius: 99,
  },
});

export default VegIndicator;
