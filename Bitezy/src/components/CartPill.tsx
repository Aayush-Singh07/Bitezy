import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
//hello world
type CartPillProps = {
  itemCount: number;
  totalWithDelivery: number;
  onPress: () => void;
};

const CartPill = ({ itemCount, totalWithDelivery, onPress }: CartPillProps) => {
  if (itemCount === 0) return null;

  return (
    <View style={styles.container} accessibilityLabel="Cart Pill" accessible={true}>
      <TouchableOpacity
        style={styles.pill}
        activeOpacity={0.9}
        onPress={onPress}
        accessibilityLabel="View Cart"
      >
        <View style={styles.left}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{itemCount}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.itemsLabel}>{itemCount === 1 ? 'Item' : 'Items'} added</Text>
            <Text style={styles.totalLabel}>₹{totalWithDelivery}</Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.viewCartText}>View Cart</Text>
          <Feather name="chevron-right" size={18} color="#FFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    zIndex: 1000,
  },
  pill: {
    backgroundColor: '#02844F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    width: 24,
    height: 24,
    backgroundColor: '#FFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  countText: {
    color: '#02844F',
    fontSize: 14,
    fontWeight: '900',
  },
  info: {},
  itemsLabel: {
    color: '#E0F2F1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCartText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 4,
  },
});

export default CartPill;
