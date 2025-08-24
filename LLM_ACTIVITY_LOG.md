# LLM Activity Log - ReflectaLab

This file records all important changes and implementations made by the LLM assistant.


*This log file should be updated after every significant LLM implementation.*

## 2025-08-24

- Switched `screens/CoachingScreen.tsx` from `useAudioTranscriptionAv` (expo-av) to `useAudioTranscription` (expo-audio) to enable real-time microphone input metering for the recording indicator. No UI changes, only hook swap. The `AudioLevelIndicator` now reflects actual levels via `recorderState.metering` with normalization and graceful fallback.

- Fixed keyboard behavior in CoachingScreen: When the text input is focused and user starts voice recording, the keyboard now stays open instead of dismissing. Applied to `handleMicrophonePress`, `handleRecordingCancel`, and `handleRecordingConfirm` functions using `isChatInputFocused` state and delayed focus restoration.
