import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2, User, Bot, Search } from 'lucide-react';
import { Type, FunctionDeclaration } from "@google/genai";
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const searchContactsTool: FunctionDeclaration = {
  name: "search_contacts",
  parameters: {
    type: Type.OBJECT,
    description: "Search for contacts by name, email, or tag.",
    properties: {
      query: {
        type: Type.STRING,
        description: "The search term (name, email, or tag).",
      },
      tag: {
        type: Type.STRING,
        description: "Filter specifically by this tag.",
      }
    },
    required: ["query"],
  },
};

const listTagsTool: FunctionDeclaration = {
  name: "list_tags",
  parameters: {
    type: Type.OBJECT,
    description: "Get a list of all unique tags used in the CRM.",
    properties: {},
  },
};

const getInteractionsTool: FunctionDeclaration = {
  name: "get_interactions",
  parameters: {
    type: Type.OBJECT,
    description: "Get the history of interactions/logs for a specific contact.",
    properties: {
      contactId: {
        type: Type.STRING,
        description: "The unique ID of the contact.",
      },
    },
    required: ["contactId"],
  },
};

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your CRM assistant. I can help you find contacts, prepare bulk emails by tag, or look up interaction history. Just ask!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const systemInstruction = "You are a helpful CRM assistant. Your goal is to help users find contact information, prepare bulk communications, and review history. \n\n- To find someone, search by tag, or get an email: use 'search_contacts'.\n- To see what tags are available: use 'list_tags'.\n- To see interaction history/logs for a contact: use 'get_interactions' with the contact's ID.\n\nWhen a user asks about the 'last interaction' or 'what was discussed', find the contact first, then fetch their interactions. Provide the date and summary clearly. For bulk emails, provide a comma-separated list of emails. Be concise and professional.";
  const tools = [searchContactsTool, listTagsTool, getInteractionsTool];

  const executeFunction = async (name: string, args: any) => {
    if (name === 'search_contacts') {
      let url = `/api/contacts?q=${encodeURIComponent(args.query)}`;
      if (args.tag) url += `&tag=${encodeURIComponent(args.tag)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data;
    }
    if (name === 'list_tags') {
      const res = await fetch('/api/tags');
      const data = await res.json();
      return data;
    }
    if (name === 'get_interactions') {
      const res = await fetch(`/api/contacts/${args.contactId}/interactions`);
      const data = await res.json();
      return data;
    }
    return { error: 'Function not found' };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Call our proxy server
      let res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          systemInstruction,
          tools
        })
      });

      let currentResponse = await res.json();

      // Handle function calls loop
      while (currentResponse.functionCalls) {
        const toolResults = [];
        for (const call of currentResponse.functionCalls) {
          const result = await executeFunction(call.name, call.args);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { result }
            }
          });
        }

        // Send tool results back to server
        res = await fetch('/api/chat/tool-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages, // Original history for context if needed by model logic
            toolResults,
            systemInstruction,
            tools
          })
        });

        currentResponse = await res.json();
      }

      if (currentResponse.error) throw new Error(currentResponse.error);

      setMessages(prev => [...prev, { role: 'assistant', content: currentResponse.text || "I've processed your request." }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-96 h-[500px] flex flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in duration-200">
          {/* Header */}
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <span className="font-semibold">CRM Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-emerald-500 p-1 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
          >
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === 'user' ? "bg-emerald-100 text-emerald-600" : "bg-white border border-slate-200 text-slate-600"
                )}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-2xl text-sm shadow-sm",
                  msg.role === 'user' 
                    ? "bg-emerald-600 text-white rounded-tr-none" 
                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none text-sm text-slate-400 border border-slate-100">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your assistant..."
                className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-emerald-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 active:scale-95 group"
        >
          <MessageSquare size={24} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </div>
  );
}
