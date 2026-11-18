// Web: modules/Food/components/user/MainTabKeepAlive.jsx — keeps the main Food tabs (Delivery Home, Takeaway Home,
// Dining, Under 250, Profile) mounted after their first visit, so switching tabs is instant (no remount, no repeated
// API calls) and every tab keeps its scroll position. Hidden tabs stay mounted with display: none.
// Scroll: the web saved / restored window.scrollY per tab; here each tab page scrolls its own list, registered in
// browseScrollMemory, and the same save (main_tab_scroll_<tab>) / restore (incl. the Home browse restore from
// food_browse_scroll_v1) runs against that list.
import { HoldWhileHidden } from '@/native/ui/HoldWhileHidden';
import React, { Suspense, memo, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FreezeLocation } from '@/lib/router';
import { HoldProfileContext } from '@food/context/ProfileContext';
import { HoldCartContext } from '@food/context/CartContext';
import { HoldThemeContext } from '@/theme';
import { StyleSheet, View } from 'react-native';
import { isModuleAuthenticated } from '@food/utils/auth';
import Home from '@food/pages/user/Home';
import Dining from '@food/pages/user/Dining';
import Under250 from '@food/pages/user/Under250';
import Profile from '@food/pages/user/profile/Profile';
import ProtectedRoute from '@food/components/ProtectedRoute';
import { AppShellSkeleton } from '@food/components/ui/loading-skeletons';
import { registerFoodPageCacheLifecycle } from '@food/utils/foodPageCache';
import { getBrowseScrollY, normalizeBrowsePath, restoreBrowseScroll, setActiveBrowseScroller } from '@food/utils/browseScrollMemory';
import { requestBottomNavShow } from '@food/utils/bottomNavEvents';
import { mainTabToPath } from '@food/utils/mainTabRoutes';

function isHomeBrowsePath(path) {
  const p = normalizeBrowsePath(path);
  return (
    p === '/user' ||
    p === '/user/takeaway' ||
    p === '/takeaway' ||
    p === '/user/dining' ||
    p === '/dining' ||
    p === '/user/under-250' ||
    p === '/under-250'
  );
}

function TabSuspense({ children }) {
  return <Suspense fallback={<AppShellSkeleton />}>{children}</Suspense>;
}

// memo: a tab page re-renders only when its own props change (or its own state / contexts), not every time this
// layer re-renders for a tab switch.
const HomePage = memo(Home);
const DiningPage = memo(Dining);
const Under250Page = memo(Under250);
const ProfilePage = memo(Profile);

const tabScrollY = (tab) => getBrowseScrollY(mainTabToPath(tab));
const scrollTab = (tab, y) => restoreBrowseScroll({ path: mainTabToPath(tab), scrollY: y }, { retries: 6 });

/**
 * Keeps main nav tabs mounted after first visit so tab switches are instant
 * (no remount, no duplicate API calls, scroll preserved per tab).
 */
// holdTab: the tab the route is on. A tab that was only announced (tapped, route not there yet) becomes visible but
// keeps its last render until the route follows, so the switch itself is a style change.
// memo: UserLayout re-renders on every navigation (useLocationNow); without it the open tab's page (Home: 4300 lines)
// was rebuilt on every tap, also when a restaurant opened on top of it.
export default memo(MainTabKeepAlive);

function MainTabKeepAlive({ activeTab, holdTab = activeTab, isVisible = true }) {
  const [visited, setVisited] = useState(() => new Set(activeTab ? [activeTab] : []));
  const scrollPositionsRef = useRef({});
  const prevTabRef = useRef(activeTab);
  const wasVisibleRef = useRef(isVisible);

  useEffect(() => {
    registerFoodPageCacheLifecycle();
  }, []);

  // Build the other main tabs in the background, one at a time once the app is idle, so even the first tap on a tab
  // shows a page that already exists (building the Takeaway home on the tap took 1-2 s). Profile only when signed in
  // (its guard would send a guest to the login screen).
  const prewarmStartedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || prewarmStartedRef.current) return undefined;
    prewarmStartedRef.current = true;
    const queue = ['takeaway', 'dining', 'under250'];
    if (isModuleAuthenticated('user')) queue.push('profile');
    let cancelled = false;
    let timer = null;
    let task = null;
    const mountNext = () => {
      // InteractionManager was removed from react-native core in 0.88; idle callback does the same job here.
      task = requestIdleCallback(() => {
        if (cancelled) return;
        const tab = queue.shift();
        if (!tab) return;
        setVisited((prev) => (prev.has(tab) ? prev : new Set([...prev, tab])));
        if (queue.length) timer = setTimeout(mountNext, 1800);
      });
    };
    timer = setTimeout(mountNext, 3500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (task != null) cancelIdleCallback(task);
      // left the tabs before it finished (opened a restaurant): carry on the next time they are shown
      if (queue.length) prewarmStartedRef.current = false;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!activeTab) return;
    setVisited((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // The open tab's list is the one browse scroll memory works with.
  useEffect(() => {
    if (isVisible && activeTab) setActiveBrowseScroller(mainTabToPath(activeTab));
  }, [isVisible, activeTab]);

  // Restore only when the tab changes or the shell becomes visible again — never while idle.
  useLayoutEffect(() => {
    const becameVisible = isVisible && !wasVisibleRef.current;
    wasVisibleRef.current = isVisible;

    if (!isVisible) {
      // Always snapshot — including 0 — so category-from-top returns to top.
      if (activeTab) {
        const y = Math.max(0, tabScrollY(activeTab));
        scrollPositionsRef.current[activeTab] = y;
        try {
          sessionStorage.setItem(`main_tab_scroll_${activeTab}`, String(y));
        } catch {}
      }
      prevTabRef.current = activeTab;
      return;
    }

    const prevTab = prevTabRef.current;
    const tabChanged = Boolean(prevTab && prevTab !== activeTab);
    // Prince (18 Nov): a tab left for another tab (bottom navigation) opens at its top next time, like Profile. Only a
    // page opened on top of a tab (restaurant, category...) brings the tab back where it was (becameVisible below).
    // The tab just left is hidden now (opacity 0): moving it to the top here cannot be seen.
    if (tabChanged) {
      scrollTab(prevTab, 0);
      scrollPositionsRef.current[prevTab] = 0;
      try {
        sessionStorage.setItem(`main_tab_scroll_${prevTab}`, '0');
      } catch {}
    }

    if (!activeTab) {
      prevTabRef.current = activeTab;
      return;
    }

    // Idle on same visible tab — do not move the list.
    if (!tabChanged && !becameVisible) {
      prevTabRef.current = activeTab;
      return;
    }

    // Only restore browse scroll when it was saved for Home (restaurant -> home), i.e. when the tabs come back from a
    // page opened on top - not on a bottom-nav tab switch (an old saved entry brought Home back to the card tapped
    // earlier instead of its top, 18 Nov).
    try {
      const rawBrowse = becameVisible ? sessionStorage.getItem('food_browse_scroll_v1') : null;
      if (rawBrowse) {
        const data = JSON.parse(rawBrowse);
        const y = Number(data?.scrollY);
        if (isHomeBrowsePath(data?.path) && Number.isFinite(y) && y >= 0) {
          scrollTab(activeTab, y);
          try {
            sessionStorage.removeItem('food_browse_scroll_v1');
          } catch {}
          requestBottomNavShow(900);
          prevTabRef.current = activeTab;
          return;
        }
      }
    } catch {}

    let savedY = scrollPositionsRef.current[activeTab];
    if (typeof savedY !== 'number') {
      try {
        const raw = sessionStorage.getItem(`main_tab_scroll_${activeTab}`);
        if (raw != null) savedY = Number(raw);
      } catch {}
    }

    const target = typeof savedY === 'number' && Number.isFinite(savedY) ? savedY : 0;
    // The kept-alive list is usually still where it was; only move it when it is not.
    if (Math.abs(tabScrollY(activeTab) - target) > 12) scrollTab(activeTab, target);

    // Scroll restore can hide bottom nav mid-tap — keep it visible briefly.
    requestBottomNavShow(900);

    prevTabRef.current = activeTab;
  }, [activeTab, isVisible]);

  useEffect(() => {
    return () => {
      const tab = prevTabRef.current;
      if (!tab) return;
      try {
        const rawBrowse = sessionStorage.getItem('food_browse_scroll_v1');
        if (rawBrowse) {
          const data = JSON.parse(rawBrowse);
          if (isHomeBrowsePath(data?.path) && Number.isFinite(Number(data?.scrollY))) {
            sessionStorage.setItem(`main_tab_scroll_${tab}`, String(Math.max(0, Number(data.scrollY))));
            return;
          }
        }
        sessionStorage.setItem(`main_tab_scroll_${tab}`, String(Math.max(0, tabScrollY(tab))));
      } catch {}
    };
  }, []);

  // The tab being opened mounts in this same render (the effect adds it to visited one render later: a blank frame).
  const shownTabs = activeTab && !visited.has(activeTab) ? new Set([...visited, activeTab]) : visited;

  // A hidden tab keeps the location it was drawn for (FreezeLocation): its useLocation / useSearchParams do not
  // re-render it on every navigation of the visible tab.
  // Which tab is shown changes in the tap's own render (a style change: instant). Which page is told it is active
  // (isTabActive: banners, polling, the status bar) follows in a deferred, interruptible render - telling the tab
  // being left in the same render rebuilt a whole Home page before the switch reached the screen (18 Nov).
  const pagesTab = useDeferredValue(activeTab);
  const pagesVisible = useDeferredValue(isVisible);
  const pageActive = (tabId) => pagesVisible && pagesTab === tabId;

  const paneStyle = (tabId) => [styles.pane, activeTab !== tabId && styles.hidden];
  const paneProps = (tabId) => ({
    style: paneStyle(tabId),
    accessibilityElementsHidden: activeTab !== tabId,
    importantForAccessibility: activeTab !== tabId ? 'no-hide-descendants' : 'auto',
    pointerEvents: activeTab === tabId ? 'auto' : 'none',
  });

  return (
    <>
      {shownTabs.has('delivery') && (
        <View {...paneProps('delivery')}>
          {/* always frozen: with homeMode set, Home needs nothing from the URL (it re-rendered on every switch to it) */}
          <FreezeLocation frozen>
          <HoldProfileContext hold={pagesTab !== 'delivery'}>
          <HoldCartContext hold={pagesTab !== 'delivery'}>
          <HoldThemeContext hold={pagesTab !== 'delivery'}>
            <HoldWhileHidden hold={holdTab !== 'delivery' && visited.has('delivery')}>
              <HomePage homeMode="delivery" isTabActive={pageActive('delivery')} />
            </HoldWhileHidden>
          </HoldThemeContext>
          </HoldCartContext>
          </HoldProfileContext>
          </FreezeLocation>
        </View>
      )}

      {shownTabs.has('takeaway') && (
        <View {...paneProps('takeaway')}>
          {/* always frozen: with homeMode set, Home needs nothing from the URL (it re-rendered on every switch to it) */}
          <FreezeLocation frozen>
          <HoldProfileContext hold={pagesTab !== 'takeaway'}>
          <HoldCartContext hold={pagesTab !== 'takeaway'}>
          <HoldThemeContext hold={pagesTab !== 'takeaway'}>
            <HoldWhileHidden hold={holdTab !== 'takeaway' && visited.has('takeaway')}>
              <HomePage homeMode="takeaway" isTabActive={pageActive('takeaway')} />
            </HoldWhileHidden>
          </HoldThemeContext>
          </HoldCartContext>
          </HoldProfileContext>
          </FreezeLocation>
        </View>
      )}

      {shownTabs.has('dining') && (
        <View {...paneProps('dining')}>
          <FreezeLocation frozen={activeTab !== 'dining'}>
          <HoldProfileContext hold={pagesTab !== 'dining'}>
          <HoldCartContext hold={pagesTab !== 'dining'}>
          <HoldThemeContext hold={pagesTab !== 'dining'}>
            <HoldWhileHidden hold={holdTab !== 'dining' && visited.has('dining')}>
              <TabSuspense>
                <DiningPage isTabActive={pageActive('dining')} />
              </TabSuspense>
            </HoldWhileHidden>
          </HoldThemeContext>
          </HoldCartContext>
          </HoldProfileContext>
          </FreezeLocation>
        </View>
      )}

      {shownTabs.has('under250') && (
        <View {...paneProps('under250')}>
          <FreezeLocation frozen={activeTab !== 'under250'}>
          <HoldProfileContext hold={pagesTab !== 'under250'}>
          <HoldCartContext hold={pagesTab !== 'under250'}>
          <HoldThemeContext hold={pagesTab !== 'under250'}>
            <HoldWhileHidden hold={holdTab !== 'under250' && visited.has('under250')}>
              <TabSuspense>
                <Under250Page isTabActive={pageActive('under250')} />
              </TabSuspense>
            </HoldWhileHidden>
          </HoldThemeContext>
          </HoldCartContext>
          </HoldProfileContext>
          </FreezeLocation>
        </View>
      )}

      {shownTabs.has('profile') && (
        <View {...paneProps('profile')}>
          <FreezeLocation frozen={activeTab !== 'profile'}>
          <HoldProfileContext hold={pagesTab !== 'profile'}>
          <HoldCartContext hold={pagesTab !== 'profile'}>
          <HoldThemeContext hold={pagesTab !== 'profile'}>
            <HoldWhileHidden hold={holdTab !== 'profile' && visited.has('profile')}>
              <ProtectedRoute requiredRole="user" loginPath="/user/auth/login">
                <TabSuspense>
                  <ProfilePage isTabActive={pageActive('profile')} />
                </TabSuspense>
              </ProtectedRoute>
            </HoldWhileHidden>
          </HoldThemeContext>
          </HoldCartContext>
          </HoldProfileContext>
          </FreezeLocation>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pane: { ...StyleSheet.absoluteFill },
  // Hidden with opacity, not display: 'none': a display-none subtree loses its native views and showing it again
  // rebuilt all of them (0.2-0.3 s per tab switch / Back).
  hidden: { opacity: 0 },
});
