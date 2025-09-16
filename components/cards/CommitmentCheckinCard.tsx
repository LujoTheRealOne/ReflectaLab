import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { CheckCircle, XCircle, Target, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface CommitmentCheckinCardProps {
  title: string;
  description?: string;
  commitmentId?: string;
  streakCount?: string;
  commitmentType?: 'one-time' | 'recurring';
  doneText?: string;
  notDoneText?: string;
  userResponse?: 'none' | 'yes' | 'no';
  onUpdate?: (response: 'yes' | 'no') => void;
}

export default function CommitmentCheckinCard({ 
  title,
  description,
  commitmentId,
  streakCount,
  commitmentType = 'one-time',
  doneText = 'Great job! Keep up the momentum.',
  notDoneText = 'No worries, let\'s get back on track.',
  userResponse = 'none',
  onUpdate
}: CommitmentCheckinCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [currentResponse, setCurrentResponse] = useState(userResponse);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update local state when props change (important for persistence across app restarts)
  useEffect(() => {
    if (userResponse !== currentResponse) {
      console.log('🔄 CommitmentCheckinCard userResponse prop changed:', { from: currentResponse, to: userResponse });
      setCurrentResponse(userResponse);
    }
  }, [userResponse, currentResponse]);

  const handleResponse = (response: 'yes' | 'no') => {
    console.log('🎯 CommitmentCheckinCard response:', response, { currentResponse, isProcessing });
    
    // Prevent double-clicks
    if (currentResponse !== 'none' || isProcessing) {
      console.log('🚫 Response blocked:', { currentResponse, isProcessing });
      return;
    }
    
    // Immediately set processing state to prevent double-clicks
    setIsProcessing(true);
    setCurrentResponse(response);
    
    // Call the parent update handler
    onUpdate?.(response);
    
    // Reset processing state after a delay (in case API call fails)
    setTimeout(() => {
      setIsProcessing(false);
    }, 5000);
  };

  const getResponseMessage = () => {
    switch (currentResponse) {
      case 'yes':
        return doneText;
      case 'no':
        return notDoneText;
      default:
        return null;
    }
  };

  const getResponseColor = () => {
    switch (currentResponse) {
      case 'yes': return '#10B981';
      case 'no': return '#F59E0B';
      default: return colors.text;
    }
  };

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colors.background,
        shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
        shadowOpacity: colorScheme === 'dark' ? 0.08 : 0.12,
        borderColor: currentResponse !== 'none' ? getResponseColor() : 'transparent',
        borderWidth: currentResponse !== 'none' ? 1 : 0,
      }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Target size={20} color={colors.text} />
          <Text style={[styles.typeText, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.40)' }]}>
            Check-in
          </Text>
        </View>
        {commitmentType === 'recurring' && streakCount && (
          <View style={styles.streakBadge}>
            <Zap size={14} color="#F59E0B" />
            <Text style={[styles.streakText, { color: '#F59E0B' }]}>
              {streakCount}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        
        {description && (
          <Text style={[styles.description, { color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)' }]}>
            {description}
          </Text>
        )}

        {/* Response Message */}
        {currentResponse !== 'none' && (
          <View style={[styles.responseMessage, { backgroundColor: `${getResponseColor()}15` }]}>
            <Text style={[styles.responseText, { color: getResponseColor() }]}>
              {getResponseMessage()}
            </Text>
          </View>
        )}
      </View>

       {/* Action Buttons */}
       {currentResponse === 'none' && (
         <View style={styles.actions}>
           <TouchableOpacity
             style={[styles.button, styles.noButton, {
               backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2',
               opacity: isProcessing ? 0.5 : 1,
             }]}
             onPress={() => handleResponse('no')}
             disabled={isProcessing}
           >
             <XCircle size={18} color={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)'} />
             <Text style={[styles.buttonText, { 
               color: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.60)'
             }]}>
               No
             </Text>
           </TouchableOpacity>
           
           <TouchableOpacity
             style={[styles.button, styles.yesButton, {
               backgroundColor: '#10B981',
               opacity: isProcessing ? 0.5 : 1,
             }]}
             onPress={() => handleResponse('yes')}
             disabled={isProcessing}
           >
             <CheckCircle size={18} color="#FFFFFF" />
             <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
               {isProcessing ? 'Processing...' : 'Yes'}
             </Text>
           </TouchableOpacity>
         </View>
       )}

      {/* Completed State */}
      {currentResponse !== 'none' && (
        <View style={styles.completedState}>
          <View style={[styles.completedIcon, { backgroundColor: `${getResponseColor()}20` }]}>
            {currentResponse === 'yes' ? (
              <CheckCircle size={20} color={getResponseColor()} />
            ) : (
              <XCircle size={20} color={getResponseColor()} />
            )}
          </View>
          <Text style={[styles.completedText, { color: getResponseColor() }]}>
            {currentResponse === 'yes' ? 'Completed' : 'Missed'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    marginTop: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  responseMessage: {
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  responseText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 44,
  },
  noButton: {
    // Styles handled by backgroundColor prop
  },
  yesButton: {
    // Styles handled by backgroundColor prop
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  completedState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  completedIcon: {
    padding: 4,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
