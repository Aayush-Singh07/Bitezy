import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import VegIndicator from '../common/VegIndicator';

const BRAND_GREEN = '#02844F';


const FilterSection = ({ activeFilter, toggleFilter }: any) => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === 'veg' && styles.filterChipActive]} 
          onPress={() => toggleFilter('veg')}
        >
          <VegIndicator isVeg={true} />
          <Text style={[styles.filterChipText, activeFilter === 'veg' && {color: '#222'}]}>Pure Veg</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === 'reordered' && styles.filterChipActive]} 
          onPress={() => toggleFilter('reordered')}
        >
          <MaterialCommunityIcons name="fire" size={16} color={activeFilter === 'reordered' ? '#FF5722' : '#666'} />
          <Text style={[styles.filterChipText, activeFilter === 'reordered' && {color: '#222'}]}>Highly Reordered</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === 'protein' && styles.filterChipActive]} 
          onPress={() => toggleFilter('protein')}
        >
          <MaterialCommunityIcons name="arm-flex" size={16} color={activeFilter === 'protein' ? '#6366F1' : '#666'} />
          <Text style={[styles.filterChipText, activeFilter === 'protein' && {color: '#222'}]}>High Protein</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === 'under49' && styles.filterChipActive]} 
          onPress={() => toggleFilter('under49')}
        >
          <MaterialCommunityIcons name="currency-inr" size={14} color={activeFilter === 'under49' ? BRAND_GREEN : '#666'} />
          <Text style={[styles.filterChipText, activeFilter === 'under49' && {color: '#222'}]}>Under 49</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  filterScroll: { paddingHorizontal: 16 },
  filterChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#E8E8E8', 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginRight: 12 
  },
  filterChipActive: { borderColor: BRAND_GREEN, backgroundColor: '#F0FDF4' },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#555', marginLeft: 6 },
  indicatorBox: { width: 14, height: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 2 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3 },
});

export default FilterSection;
