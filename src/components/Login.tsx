import React from 'react';
import { loginWithGoogle } from '../lib/firebase';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#F0F2F5]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-[500px] w-[400px] flex-col items-center justify-center space-y-8 rounded-2xl bg-white p-12 shadow-xl"
      >
        <div className="flex aspect-square w-24 items-center justify-center rounded-full bg-[#00a884]">
          <LogIn className="h-12 w-12 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Echo Chat</h1>
          <p className="mt-2 text-gray-500">Connect with friends in real-time</p>
        </div>
        <button
          onClick={loginWithGoogle}
          className="flex w-full items-center justify-center space-x-3 rounded-lg border border-gray-300 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
          <span className="font-semibold text-gray-700">Continue with Google</span>
        </button>
      </motion.div>
    </div>
  );
};
