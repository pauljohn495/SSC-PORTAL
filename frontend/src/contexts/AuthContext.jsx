import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser && storedUser !== 'undefined') {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const updateStoredUser = (updater) => {
    setUser(prevUser => {
      const nextUser = typeof updater === 'function' ? updater(prevUser) : updater;

      if (nextUser) {
        localStorage.setItem('user', JSON.stringify(nextUser));
      } else {
        localStorage.removeItem('user');
      }

      return nextUser || null;
    });
  };

  const login = (userData) => {
    if (!userData || !userData.role) {
      console.error('Invalid user data provided');
      return;
    }
    updateStoredUser(userData);

  };

  const isAdmin = () => {
    return user && user.role === 'admin';
  };

  const logout = () => {
    updateStoredUser(null);
  };

  const updateUser = (updates) => {
    if (!updates) {
      return;
    }

    updateStoredUser(prevUser => {
      if (!prevUser) {
        return updates;
      }

      const nextUser = {
        ...prevUser,
        ...updates
      };

      if (!nextUser.role && prevUser.role) {
        nextUser.role = prevUser.role;
      }

      return nextUser;
    });
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAdmin,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
