// /food/user/auth/otp — web: <AuthRedirect module="user"><Page /></AuthRedirect>
import React from 'react';
import Page from '@food/pages/user/auth/OTP';
import AuthRedirect from '@food/components/AuthRedirect';
import { publicRoute } from '@food/components/user/UserRouter';

function GuestOnly(props) {
  return (
    <AuthRedirect module="user">
      <Page {...props} />
    </AuthRedirect>
  );
}

export default publicRoute(GuestOnly);
