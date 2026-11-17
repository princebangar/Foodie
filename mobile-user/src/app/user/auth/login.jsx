// /user/auth/login — the customer login (web: modules/auth/routes.jsx: <AuthRedirect module="user"><Login animate={false} /></AuthRedirect>)
import React from 'react';
import Login from '@/modules/auth/pages/Login';
import AuthRedirect from '@food/components/AuthRedirect';

export default function UserLoginRoute() {
  return (
    <AuthRedirect module="user">
      <Login animate={false} />
    </AuthRedirect>
  );
}
