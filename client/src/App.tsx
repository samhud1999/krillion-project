import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { codeFromRoute, navigate, useRoute } from './router';
import { useStore } from './ws';
import { ToastHost } from './components/Toast';
import { ConnectionBanner } from './components/ConnectionBanner';
import { JoinScreen } from './screens/player/JoinScreen';
import { PlayerGame } from './screens/player/PlayerGame';
import { HostScreen } from './screens/host/HostScreen';

/**
 * Routes:
 *   /            join screen (also /join/ABCD and /?code=ABCD prefill the code)
 *   /play        the player's game, needs a saved player session
 *   /host        the big screen; creates or resumes a room
 */
export function App() {
  const route = useRoute();
  const { session } = useStore();
  const isHost = route.path === '/host' || route.path.startsWith('/host/');
  const isPlay = route.path === '/play';

  useEffect(() => {
    if (isPlay && session?.role !== 'player') navigate('/', { replace: true });
  }, [isPlay, session]);

  let screen: React.ReactNode;
  if (isHost) screen = <HostScreen />;
  else if (isPlay && session?.role === 'player') screen = <PlayerGame />;
  else screen = <JoinScreen prefillCode={codeFromRoute(route)} />;

  return (
    // springs and layout animations respect the OS "reduce motion" setting
    <MotionConfig reducedMotion="user">
      <ConnectionBanner />
      <ToastHost />
      {screen}
    </MotionConfig>
  );
}
