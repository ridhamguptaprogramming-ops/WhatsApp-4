import React from 'react';
import { MessageSquare } from 'lucide-react';

export const EmptyState: React.FC = () => {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center bg-[#f8f9fa] border-b-[6px] border-[#00a884]">
      <div className="flex flex-col items-center text-center">
        <div className="mb-8 flex aspect-square w-64 items-center justify-center rounded-full bg-[#f0f2f5]">
           <MessageSquare className="h-32 w-32 text-[#d1d7db]" />
        </div>
        <h1 className="text-3xl font-light text-[#41525d]">Echo Chat for Web</h1>
        <p className="mt-4 max-w-sm text-sm text-[#667781] leading-relaxed">
          Send and receive messages in real-time. Start a new conversation by clicking the plus icon in the sidebar.
        </p>
      </div>
      <div className="mt-20 flex items-center space-x-2 text-xs text-[#8696a0]">
        <span className="flex items-center space-x-2">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
            <path d="M15.8 8H14V5.6C14 2.5 11.5 0 8.4 0 5.3 0 2.8 2.5 2.8 5.6V8H1V20h14.8V8zM4.6 5.6C4.6 3.5 6.3 1.8 8.4 1.8s3.8 1.7 3.8 3.8V8H4.6V5.6z"></path>
          </svg>
          <span>End-to-end encrypted</span>
        </span>
      </div>
    </div>
  );
};
