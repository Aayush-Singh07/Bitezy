import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SectionHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionTitleCap}>{title.toUpperCase()}</Text>
    <View style={styles.greenTitleBlock} />
  </View>
);

const styles = StyleSheet.create({
  sectionHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    marginHorizontal: 16, 
    marginTop: 15, 
    marginBottom: 10 
  },
  sectionTitleCap: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#222', 
    fontStyle: 'italic', 
    letterSpacing: -0.5 
  },
  greenTitleBlock: { 
    width: 14, 
    height: 6, 
    backgroundColor: '#02844F', 
    marginLeft: 4, 
    marginBottom: 4 
  },
});

export default SectionHeader;
