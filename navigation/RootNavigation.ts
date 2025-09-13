import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

// Root navigation ref to navigate outside of screen components
export const rootNavigationRef = createNavigationContainerRef<any>();

// Navigate to a screen inside the App stack from anywhere
export function navigateToAppScreen(screenName: string, params?: Record<string, any>) {
  console.log('🧭 NavigateToAppScreen called:', { screenName, params, isReady: rootNavigationRef.isReady() });
  
  if (!rootNavigationRef.isReady()) {
    console.log('❌ RootNavigationRef not ready yet');
    return;
  }

  try {
    console.log('🚀 Dispatching navigation to App stack:', screenName);
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'App' as any,
        params: { screen: screenName as any, params },
      })
    );
    console.log('✅ Navigation dispatched successfully');
  } catch (err) {
    console.log('❌ Navigation failed:', err);
  }
}


