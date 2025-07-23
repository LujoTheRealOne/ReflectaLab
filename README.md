# Reflecta

An intelligent journaling app with AI-powered coaching capabilities built with React Native and Expo.

#### The Mobile App is developed by Luca Wernicke

## 📱 Overview

Reflecta is a mobile journaling application that combines personal reflection with AI-powered coaching. Users can write journal entries using a rich text editor, and receive contextual AI coaching feedback to help deepen their self-reflection and personal growth.

## 🛠 Tech Stack

### Frontend
- **React Native** (0.79.5) with **Expo** (53.x)
- **TypeScript** for type safety
- **React Navigation** for navigation (drawer + stack)
- **TipTap** for rich text editing
- **Reanimated** for smooth animations

### Backend & Services
- **Firebase Firestore** for data storage
- **Clerk** for authentication (with Apple Sign-In support)
- **OpenAI API** for AI coaching capabilities
- **Expo API Routes** for backend functionality

### Development
- **EAS Build** for deployments
- **Metro** bundler
- **Babel** for transpilation

## 🚀 Getting Started

### Prerequisites
- Node.js (18+ recommended)
- **npm** or *yarn*
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio/Emulator (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ReflectaLabs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Configure Firebase**
   - The Firebase configuration is already set up in `lib/firebase.ts`
   - Ensure you have access to the `reflecta-labs-v2` Firebase project

5. **Start the development server**
   ```bash
   npm start
   ```

### Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run web` - Run in web browser

## 📁 Project Structure

```
├── api/                          # Expo API routes
│   └── coaching-interaction/     # AI coaching endpoints
├── assets/                       # Static assets (fonts, images)
├── components/                   # Reusable React components
│   ├── ui/                       # UI primitives
│   ├── AIChatInterface.tsx       # AI chat component
│   ├── TipTap.tsx               # Rich text editor
│   └── JournalDrawer.tsx        # Navigation drawer
├── constants/                    # App constants and themes
├── hooks/                        # Custom React hooks
├── lib/                          # Core business logic
│   ├── coaching/                 # AI coaching system
│   │   ├── models/              # Different coaching models
│   │   └── contextBuilder.ts    # Context building for AI
│   ├── firebase.ts              # Firebase config
│   └── clerk-firebase-auth.ts   # Auth integration
├── navigation/                   # Navigation setup
├── screens/                      # Screen components
│   ├── auth/                    # Authentication screens
│   └── HomeContent.tsx          # Main journaling interface
├── services/                     # External service integrations
├── types/                        # TypeScript type definitions
└── styles/                       # Global styles
```

## 🧠 AI Coaching System

The app features a sophisticated AI coaching system with multiple models:

### Coaching Models
- **General Coaching Model**: Provides general reflection and guidance
- **Biggest Struggle Model**: Focuses on helping users work through challenges

### Model Architecture
- **Model Registry**: Manages and routes between different coaching models
- **Context Builder**: Constructs rich context for AI interactions
- **Streaming Support**: Real-time AI response streaming

### Usage
The AI coaching system automatically analyzes journal entries and provides contextual feedback through:
- Text responses
- Interactive buttons
- Multi-select options

## 🔐 Authentication

The app uses Clerk for authentication with the following features:
- Apple Sign-In integration
- Secure token management
- Seamless onboarding flow

## 💾 Data Storage

### Firebase Firestore
- Journal entries storage
- User preferences
- Coaching interaction history

### Security
- User-based security rules
- Encrypted data transmission
- Secure token storage

## 🎨 UI/UX Features

- **Rich Text Editor**: Full-featured writing experience with TipTap
- **Dark/Light Mode**: Automatic theme switching
- **Haptic Feedback**: Enhanced user interactions
- **Network Status**: Offline capability indicators
- **Responsive Design**: Optimized for various screen sizes

## 📱 Platform Support

- **iOS**: Native iOS app with Apple Sign-In
- ~~**Android**: Native Android app~~
(Android will follow soon. Currently we only focus on iOS support.)

## 🔧 Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow React Native best practices
- Implement proper error handling
- **Use hooks for state management**

### File Naming
- Components: PascalCase (e.g., `AIChatInterface.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAICoaching.ts`)
- Types: PascalCase (e.g., `CoachingContext`)
- Constants: UPPER_SNAKE_CASE

### Adding New Features
1. Create appropriate TypeScript types in `types/`
2. Implement business logic in `lib/`
3. Create reusable components in `components/`
4. Add screens in `screens/`
5. Update navigation if needed

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler issues**: Clear cache with `expo start --clear`
2. **iOS build issues**: Clean iOS build folder
3. **Authentication issues**: Verify Clerk configuration
4. **Firebase issues**: Check network connectivity and Firebase rules

### Environment Setup
- Ensure all environment variables are properly set
- Verify Firebase project access
- Check Clerk dashboard configuration