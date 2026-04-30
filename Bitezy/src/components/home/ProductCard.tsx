import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import VegIndicator from '../common/VegIndicator';

const BRAND_GREEN = '#02844F';


const ProductCard = ({ item, onAdd, btnDisabled, isOpen }: any) => {
  const soldOut = !item.is_available;
  const isActuallyDisabled = btnDisabled || !isOpen || soldOut;

  return (
    <TouchableOpacity
      style={[styles.productCard]}
      onPress={() => onAdd(item)}
      activeOpacity={0.9}
    >
      <View style={styles.productCardImgWrap}>
        <Image source={{ uri: item.image }} style={styles.productCardImg} />
        
        {item.highly_reordered && (
          <View style={styles.reorderedBadge}>
            <Text style={styles.reorderedText}>🔥 TOP CHOICE</Text>
          </View>
        )}
        
        {item.is_high_protein && (
          <View style={[styles.reorderedBadge, item.highly_reordered && styles.proteinBadge]}>
            <Text style={styles.proteinText}>💪 HIGH PROTEIN</Text>
          </View>
        )}

        {soldOut ? (
          <View style={[styles.addBtnAbsCard, styles.soldOutBtn]}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtnAbsCard, !isOpen && styles.addBtnDisabled]}
            onPress={() => onAdd(item)}
          >
            <Text style={[styles.addBtnTextCard, !isOpen && styles.addBtnTextDisabled]}>ADD</Text>
            <View style={styles.addPlusCard}>
              <Feather name="plus" size={10} color={isOpen ? BRAND_GREEN : '#AAA'} />
            </View>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.productCardInfo}>
        <VegIndicator isVeg={item.isVeg} />
        <Text style={[styles.productCardName, soldOut && styles.textMuted]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={[styles.productPrice, soldOut && styles.textMuted]}>₹{item.price}</Text>
          {item.gimmick_price && (
            <Text style={styles.gimmickPrice}>₹{item.gimmick_price}</Text>
          )}
        </View>
        <Text style={styles.productDesc} numberOfLines={2}>{item.desc}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  productCard: { width: 155, marginRight: 15, marginBottom: 10 },
  productCardDisabled: { opacity: 0.6 },
  productCardImgWrap: { 
    width: 155, height: 155, borderRadius: 16, 
    position: 'relative', marginBottom: 18,
    backgroundColor: '#F5F5F5'
  },
  productCardImg: { width: 155, height: 155, borderRadius: 16, backgroundColor: '#EEE' },
  addBtnAbsCard: { 
    position: 'absolute', bottom: -14, alignSelf: 'center', 
    width: 96, height: 36, backgroundColor: '#FFF', 
    borderRadius: 8, flexDirection: 'row', 
    justifyContent: 'center', alignItems: 'center', 
    elevation: 4, borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  addBtnDisabled: { backgroundColor: '#F0F0F0', borderColor: '#E0E0E0', elevation: 0 },
  addBtnTextCard: { color: BRAND_GREEN, fontSize: 15, fontWeight: '900', marginRight: 2 },
  addBtnTextDisabled: { color: '#AAA' },
  addPlusCard: { position: 'absolute', top: 5, right: 6 },
  soldOutBtn: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0', elevation: 0 },
  soldOutText: { fontSize: 11, fontWeight: '900', color: '#AAA', letterSpacing: 0.5 },
  productCardInfo: { paddingHorizontal: 2 },
  indicatorBox: { width: 14, height: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 2, marginBottom: 4 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3 },
  productCardName: { fontSize: 15, fontWeight: '800', color: '#222', marginTop: 4, marginBottom: 4, letterSpacing: -0.3, lineHeight: 18 },
  textMuted: { color: '#AAA' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#222' },
  productDesc: { fontSize: 11, color: '#666', lineHeight: 16 },
  reorderedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 87, 34, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reorderedText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  proteinBadge: {
    top: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
  },
  proteinText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  gimmickPrice: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginLeft: 6,
    fontWeight: '600'
  }
});

export default ProductCard;
