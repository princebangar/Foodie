// /food/user/restaurants/:slug — open to guests
// Prince (18 Nov): tapping a restaurant card did not answer at once - the page's first render (4500 lines of hooks and
// memos, ~250 ms on the phone) had to finish before anything moved. The screen now shows the restaurant skeleton in
// its first frame and mounts the real page one frame later, so the tap is answered immediately.
import React, { useEffect, useState } from 'react';
import Page from '@food/pages/user/restaurants/RestaurantDetails';
import { publicRoute } from '@food/components/user/UserRouter';
import { RestaurantDetailSkeleton } from '@food/components/ui/loading-skeletons';
import { Screen } from '@/native/ui';
import { colors, useTheme } from '@/theme';

function RestaurantRoute(props) {
  const t = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // two frames: the skeleton is committed and drawn before the heavy mount starts
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setMounted(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  if (mounted) return <Page {...props} />;
  return (
    <Screen bg={t.dark ? '#0a0a0a' : colors.white}>
      <RestaurantDetailSkeleton />
    </Screen>
  );
}

export default publicRoute(RestaurantRoute);
