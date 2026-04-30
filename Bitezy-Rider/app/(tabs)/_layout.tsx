import { Tabs } from 'expo-router';
import { Home, List, User } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#02844F',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        height: 60,
        paddingBottom: 8,
      },
      headerShown: false,
      headerStyle: {
        backgroundColor: '#ffffff',
      },
      headerTitleStyle: {
        fontWeight: '900',
        color: '#000000',
        fontSize: 18,
      },
      headerShadowVisible: false,
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerTitle: 'BITEZY RIDER',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: 'Missions',
          headerTitle: 'MY MISSIONS',
          tabBarIcon: ({ color, size }) => <List color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'MY PROFILE',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
