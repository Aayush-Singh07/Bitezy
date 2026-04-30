import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

const BRAND_GREEN = '#30A939';
const LIGHT_BG = '#F7F9FC';

const HotNowScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoB}>B</Text>
            </View>
            <Text style={styles.logoText}>Bitezy</Text>
          </View>
          <TouchableOpacity style={styles.locationSelector}>
            <Feather name="map-pin" size={14} color="#666" />
            <Text style={styles.locationText}>Karol Bagh</Text>
            <Feather name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
            <Feather name="user" size={24} color="#222" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>🔥 Hot Now in Karol Bagh</Text>
          <Text style={styles.subtitle}>See what everyone is ordering right now!</Text>
        </View>

        {/* Live Trending Box */}
        <View style={styles.trendingBox}>
           <Text style={styles.trendingLabel}>🔥 Live Trending</Text>
           <Text style={styles.trendingNumber}>102+</Text>
           <Text style={styles.trendingSubtext}>ORDERS IN LAST HOUR</Text>
        </View>

        {/* Ranked Item 1 */}
        <View style={styles.rankedCard}>
          <View style={[styles.imageWrapper, { backgroundColor: '#E8F5E9' }]}>
             <View style={styles.rankBadge}>
               <Text style={styles.rankText}>1</Text>
             </View>
             <Image source={{ uri: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=400&fit=crop' }} style={styles.foodImage} />
          </View>
          <View style={styles.cardInfo}>
             <Text style={styles.foodTitle}>Classic Vada Pav (Hot) 🔥</Text>
             <Text style={styles.foodDetails}>₹30. Ready in 10 min.</Text>
             <Text style={styles.foodHighlight}>50+ people just viewed!</Text>
             <TouchableOpacity style={styles.actionBtn}>
               <Text style={styles.actionBtnText}>Add to Cart</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Reorder Widget */}
        <View style={styles.reorderWidget}>
           <View style={styles.widgetLeft}>
              <View style={styles.widgetHeaderRow}>
                 <Ionicons name="heart" size={18} color="#D32F2F" />
                 <Text style={styles.widgetTitle}>Dhurandhar's Favorite Quick Reorder</Text>
              </View>
              <Text style={styles.widgetDesc}>Reorder your Vada Pav & Chai in 1-tap!</Text>
           </View>
           <TouchableOpacity style={styles.widgetBtn}>
             <Text style={styles.widgetBtnText}>Reorder</Text>
           </TouchableOpacity>
        </View>

        {/* Ranked Item 2 */}
        <View style={styles.rankedCard}>
          <View style={[styles.imageWrapper, { backgroundColor: '#FFF3E0' }]}>
             <View style={styles.rankBadge}>
               <Text style={styles.rankText}>2</Text>
             </View>
             <Image source={{ uri: 'https://plus.unsplash.com/premium_photo-1669687920700-1c58c21a4fb0?w=400&h=400&fit=crop' }} style={styles.foodImage} />
          </View>
          <View style={styles.cardInfo}>
             <Text style={styles.foodTitle}>Samosa (2pcs) 🔥</Text>
             <Text style={styles.foodDetails}>₹25. Ready in 10 min.</Text>
             <Text style={styles.foodHighlight}>Karol Bagh favorite!</Text>
             <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]}>
               <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]}>Reorder in 1-tap!</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Ranked Item 3 */}
        <View style={styles.rankedCard}>
          <View style={[styles.imageWrapper, { backgroundColor: '#FBE9E7' }]}>
             <View style={styles.rankBadge}>
               <Text style={styles.rankText}>3</Text>
             </View>
             <Image source={{ uri: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=400&fit=crop' }} style={styles.foodImage} />
          </View>
          <View style={styles.cardInfo}>
             <Text style={styles.foodTitle}>Stuffed Bread Pakora</Text>
             <Text style={styles.foodDetails}>₹35. Ready in 10 min.</Text>
             <Text style={styles.foodHighlightDark}>Next Flash Sale! - Next 30 mins</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: LIGHT_BG,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 8,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  logoB: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#222',
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 13,
    color: '#333',
    marginHorizontal: 4,
    fontWeight: '600',
  },
  iconButton: {
    padding: 4,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#222',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  trendingBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  trendingLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 10,
  },
  trendingNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#222',
    marginBottom: 4,
  },
  trendingSubtext: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
  },
  rankedCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: '#5D4037',
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  rankText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  foodImage: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  cardInfo: {
    padding: 20,
  },
  foodTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
  },
  foodDetails: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  foodHighlight: {
    fontSize: 13,
    color: BRAND_GREEN,
    fontWeight: '600',
    marginBottom: 15,
  },
  foodHighlightDark: {
    fontSize: 13,
    color: '#5D4037',
    fontWeight: '600',
    marginBottom: 5, // No button below it
  },
  actionBtn: {
    backgroundColor: BRAND_GREEN,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnOutline: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: BRAND_GREEN,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  actionBtnTextOutline: {
    color: BRAND_GREEN,
  },
  reorderWidget: {
    backgroundColor: '#FFF9C4', // Yellowish highlight box
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  widgetLeft: {
    flex: 1,
  },
  widgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  widgetTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 6,
  },
  widgetDesc: {
    fontSize: 12,
    color: '#555',
    paddingLeft: 24, // Align with text above
  },
  widgetBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  widgetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_GREEN,
  },
});

export default HotNowScreen;
