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

const createInteractionTool: FunctionDeclaration = {
  name: "create_interaction",
  parameters: {
    type: Type.OBJECT,
    description: "Log a new interaction (summary of discussion, call, meeting) for a specific contact.",
    properties: {
      contactId: {
        type: Type.STRING,
        description: "The unique ID of the contact.",
      },
      date: {
        type: Type.STRING,
        description: "The date of the interaction (YYYY-MM-DD). Use today's date if not specified.",
      },
      description: {
        type: Type.STRING,
        description: "A summary of what was discussed.",
      }
    },
    required: ["contactId", "description"],
  },
};

const searchInteractionsTool: FunctionDeclaration = {
  name: "search_interactions_globally",
  parameters: {
    type: Type.OBJECT,
    description: "Search all interaction logs across all contacts for specific keywords (e.g., 'budget', 'meeting').",
    properties: {
      query: {
        type: Type.STRING,
        description: "The keyword to search for in interaction summaries.",
      }
    },
    required: ["query"],
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

  const systemInstruction = "You are a highly efficient CRM assistant. Your primary objective is to help the user manage their professional relationships through the CRM API.\n\n### CORE CAPABILITIES:\n1. **Find Contacts:** Use 'search_contacts' by name, email, or tag. ALWAYS verify you have the correct contact ID before logging interactions.\n2. **Manage Interactions:** \n   - To see history: use 'get_interactions' with a contactId.\n   - To log a NEW discussion: use 'create_interaction'. This is vital for keeping logs up to date. Date defaults to today if omitted.\n   - To find specific past discussions: use 'search_interactions_globally' to find keywords across all logs.\n3. **Insights:** Help users summarize what has been discussed recently with specific tags or people.\n\n### GUIDELINES:\n- When asked 'what was our last talk with John?', first SEARCH for John, then FETCH his interactions, then summarize.\n- If multiple contacts match a name, list them and ask for clarification.\n- For bulk email requests (e.g., 'get emails for all investors'), return a clean comma-separated list.\n- Be concise, professional, and technical where appropriate (e.g., referencing 'ID' or 'Interaction Log').";
  const tools = [searchContactsTool, listTagsTool, getInteractionsTool, createInteractionTool, searchInteractionsTool];

  const executeFunction = async (name: string, args: any) => {
    if (name === 'search_contacts') {
      let url = `/api/contacts?q=${encodeURIComponent(args.query)}`;
      if (args.tag) url += `&tag=${encodeURIComponent(args.tag)}`;
      const res = await fetch(url);
      return await res.json();
    }
    if (name === 'list_tags') {
      const res = await fetch('/api/tags');
      return await res.json();
    }
    if (name === 'get_interactions') {
      const res = await fetch(`/api/contacts/${args.contactId}/interactions`);
      return await res.json();
    }
    if (name === 'search_interactions_globally') {
      const res = await fetch(`/api/interactions/search?q=${encodeURIComponent(args.query)}`);
      return await res.json();
    }
    if (name === 'create_interaction') {
      const payload = {
        date: args.date || new Date().toISOString().split('T')[0],
        description: args.description
      };
      const res = await fetch(`/api/contacts/${args.contactId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const error = await res.json();
        return { error: error.message || 'Failed to create interaction via API' };
      }
      return await res.json();
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
