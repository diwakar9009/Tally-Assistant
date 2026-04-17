/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Image as ImageIcon, 
  Plus, 
  BookOpen, 
  History, 
  Settings, 
  HelpCircle,
  Calculator,
  FileText,
  MessageSquare,
  LayoutDashboard,
  GraduationCap,
  Keyboard,
  ChevronRight,
  Loader2,
  Trash2,
  Camera,
  Monitor,
  Lightbulb,
  Mic,
  Volume2,
  Menu,
  Download,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  CheckCheck,
  ChevronUp,
  ChevronDown,
  Info,
  Sun,
  Moon,
  LogOut,
  User,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  ShieldCheck,
  Paperclip
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeTransaction } from './lib/gemini';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, startOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface Entry {
  ledgerName: string;
  amount: number;
  entryType: 'DR' | 'CR';
}

interface Voucher {
  id?: string;
  type: 'Payment' | 'Receipt' | 'Contra' | 'Journal' | 'Sales' | 'Purchase';
  totalAmount: number;
  narration: string;
  entries: Entry[];
  date: any;
  createdBy: string;
}

interface Ledger {
  id: string;
  name: string;
  group: string;
  currentBalance: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
  delivered?: boolean;
}

export default function App() {
  const [user, setUser] = useState<{ displayName: string; email: string; photoURL?: string; uid: string } | null>({
    displayName: 'Professional Accountant',
    email: 'accountant@enterprise.ai',
    uid: 'local-user-001'
  });
  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    const saved = localStorage.getItem('tally-vouchers');
    return saved ? JSON.parse(saved) : [];
  });
  const [ledgers, setLedgers] = useState<Ledger[]>(() => {
    const saved = localStorage.getItem('tally-ledgers');
    if (saved) return JSON.parse(saved);
    
    // Default ledgers
    return [
      { id: 'l1', name: 'Cash', group: 'Assets', currentBalance: 50000 },
      { id: 'l2', name: 'Bank', group: 'Assets', currentBalance: 250000 },
      { id: 'l3', name: 'Sales', group: 'Revenue', currentBalance: 0 },
      { id: 'l4', name: 'Rent', group: 'Expenses', currentBalance: 0 },
      { id: 'l5', name: 'Office Supplies', group: 'Expenses', currentBalance: 0 }
    ];
  });

  useEffect(() => {
    localStorage.setItem('tally-vouchers', JSON.stringify(vouchers));
  }, [vouchers]);

  useEffect(() => {
    localStorage.setItem('tally-ledgers', JSON.stringify(ledgers));
  }, [ledgers]);

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('tally-messages');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
    }
    return [
      {
        id: '1',
        role: 'assistant',
        content: 'नमस्ते! मैं आपका Accounting Assistant हूँ। आप मुझे कोई भी transaction बता सकते हैं, और मैं उसे record कर दूँगा।\n\nउदाहरण के लिए: "Spent 500 on dinner with clients"\n\n**Tip:** Dashboard चेक करें अपनी Financial Health देखने के लिए!',
        timestamp: new Date(),
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('tally-messages', JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [learningMode, setLearningMode] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());

  const handleLogout = () => {
    setUser(null);
    toast.success('Logged out (Local Session)');
  };

  const recordVoucher = (vData: Partial<Voucher>) => {
    const newVoucher: Voucher = {
      ...vData as Voucher,
      id: Date.now().toString(),
      date: new Date(),
      createdBy: user?.uid || 'guest'
    };

    setVouchers(prev => [newVoucher, ...prev]);

    // Update ledgers
    if (vData.entries) {
      setLedgers(prevLedgers => {
        return prevLedgers.map(l => {
          const matchingEntry = vData.entries?.find(e => e.ledgerName === l.name);
          if (matchingEntry) {
            let newBalance = l.currentBalance;
            const isAssetOrExpense = ['Assets', 'Expenses'].includes(l.group);
            
            if (matchingEntry.entryType === 'DR') {
              newBalance += isAssetOrExpense ? matchingEntry.amount : -matchingEntry.amount;
            } else {
              newBalance += isAssetOrExpense ? -matchingEntry.amount : matchingEntry.amount;
            }
            return { ...l, currentBalance: newBalance };
          }
          return l;
        });
      });
    }
    
    toast.success(`${vData.type} recorded locally`);
  };

  const toggleCollapse = (id: string) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };
  const [isListening, setIsListening] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [simView, setSimView] = useState<'gateway' | 'voucher' | 'report'>('gateway');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tally-theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tally-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tally-theme', 'light');
    }
  }, [darkMode]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') || 
                     scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    
    if (viewport) {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 200;
      // Auto-scroll to bottom only if user is already near bottom or it's the first message
      if (isNearBottom || messages.length <= 2) {
        viewport.scrollTo({ 
          top: viewport.scrollHeight, 
          behavior: messages.length <= 2 ? 'auto' : 'smooth' 
        });
      }
    }
  }, [messages]);

  const handleSend = async () => {
    console.log("handleSend triggered. Input:", input, "Image:", !!selectedImage);
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      image: selectedImage || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    console.log("Checking API Key in App.tsx. Defined:", typeof process !== 'undefined' && !!process.env.GEMINI_API_KEY);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out. This can happen if the API key is invalid or there's a network issue.")), 20000)
    );

    try {
      let responseText = '';
      console.log("Sending to AI:", selectedImage ? "Image" : input);
      
      const apiCall = selectedImage 
        ? analyzeTransaction({ 
            mimeType: selectedImage.split(';')[0].split(':')[1], 
            data: selectedImage.split(',')[1] 
          }, true)
        : analyzeTransaction(input);

      console.log("Waiting for Promise.race...");
      responseText = await Promise.race([apiCall, timeoutPromise]) as string;
      console.log("Promise.race resolved. Response length:", responseText?.length);

      if (!responseText) {
        console.error("No response text received from AI");
        throw new Error("No response text received from AI");
      }

      console.log("Creating assistant message...");
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      console.log("Updating messages state...");
      setMessages(prev => [...prev, assistantMessage]);
      console.log("Messages state updated. Current count:", messages.length + 1);

      // Check for structured data to record
      if (responseText.includes('accounting-data')) {
        const jsonMatch = responseText.match(/```accounting-data\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            if (data.transactionFound && data.voucher) {
              recordVoucher(data.voucher);
            }
          } catch (e) {
            console.error("Failed to parse accounting data:", e);
          }
        }
      }

      setSelectedImage(null);
      setSimView('gateway');
      setActiveTab('chat');
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast.error(errorMessage);
      
      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Error:** ${errorMessage}\n\nPlease make sure your **GEMINI_API_KEY** is set correctly in the **Secrets** panel (Settings -> Secrets).`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
  };

  const clearHistory = () => {
    setMessages([messages[0]]);
    toast.success('Chat history cleared');
  };

  const exportMessage = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tally-advice-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Advice exported as text file');
  };

  const stats = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 5);
    
    // Monthly data for chart
    const monthlyDataMap = new Map();
    for(let i = 0; i < 6; i++) {
      const month = format(subMonths(now, i), 'MMM');
      monthlyDataMap.set(month, { month, revenue: 0, expenses: 0 });
    }

    vouchers.forEach(v => {
      if (!v.date) return;
      const vDate = new Date(v.date);
      const monthKey = format(vDate, 'MMM');
      
      if (monthlyDataMap.has(monthKey)) {
        const current = monthlyDataMap.get(monthKey);
        if (v.type === 'Sales') current.revenue += v.totalAmount;
        if (v.type === 'Payment' || v.type === 'Purchase') current.expenses += v.totalAmount;
      }
    });

    const chartData = Array.from(monthlyDataMap.values()).reverse();

    const totalCash = vouchers.filter(v => v.type === 'Receipt').reduce((acc, v) => acc + v.totalAmount, 0) - 
                      vouchers.filter(v => v.type === 'Payment').reduce((acc, v) => acc + v.totalAmount, 0);
    const totalRevenue = vouchers.filter(v => v.type === 'Sales').reduce((acc, v) => acc + v.totalAmount, 0);
    const totalExpenses = vouchers.filter(v => v.type === 'Payment' || v.type === 'Purchase').reduce((acc, v) => acc + v.totalAmount, 0);
    
    return {
      balance: totalCash,
      revenue: totalRevenue,
      expenses: totalExpenses,
      recentCount: vouchers.length,
      chartData
    };
  }, [vouchers]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <Button onClick={() => setUser({
          displayName: 'Professional Accountant',
          email: 'accountant@enterprise.ai',
          uid: 'local-user-001'
        })}>
          Restart Local Session
        </Button>
      </div>
    );
  }

  const lastAssistantMessage = useMemo(() => {
    return [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  }, [messages]);

  // Extract Tally info for simulation
  const tallyInfo = useMemo(() => {
    if (!lastAssistantMessage) return null;
    console.log("Extracting Tally info from message length:", lastAssistantMessage.length);
    
    // More robust regexes to handle emojis, markdown, and different labels
    const voucherMatch = lastAssistantMessage.match(/(?:Voucher\/Report Type|Voucher Type|Voucher)\s*[:*-]*\s*(.*)/i);
    const pathMatch = lastAssistantMessage.match(/(?:Tally Path|Path)\s*[:*-]*\s*(.*)/i);
    const debitMatch = lastAssistantMessage.match(/(?:Debit|Dr)\s*[:*-]*\s*(.*)/i);
    const creditMatch = lastAssistantMessage.match(/(?:Credit|Cr)\s*[:*-]*\s*(.*)/i);
    const amountMatch = lastAssistantMessage.match(/(?:Amount\/Tax Details|Amount|₹|Total)\s*[:*-]*\s*(?:₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    const narrationMatch = lastAssistantMessage.match(/(?:Narration|Being)\s*[:*-]*\s*(.*)/i);
    const itemsMatch = lastAssistantMessage.match(/(?:Item Details|Items|Inventory)\s*[:*-]*\s*([\s\S]*?)(?=\n\n|###|$)/i);
    const reportMatch = lastAssistantMessage.match(/(?:Report Type|Report)\s*[:*-]*\s*(.*)/i);
    const gstMatch = lastAssistantMessage.match(/(?:GST Details|Tax Details)\s*[:*-]*\s*([\s\S]*?)(?=\n\n|###|$)/i);
    const payrollMatch = lastAssistantMessage.match(/(?:Payroll Details|Salary Details)\s*[:*-]*\s*([\s\S]*?)(?=\n\n|###|$)/i);
    
    const info = {
      voucher: voucherMatch ? voucherMatch[1].split('\n')[0].replace(/[#*:]/g, '').trim() : 'Payment',
      path: pathMatch ? pathMatch[1].split('\n')[0].replace(/[#*:]/g, '').trim() : 'Gateway of Tally',
      debit: debitMatch ? debitMatch[1].split('\n')[0].replace(/[#*:]/g, '').trim() : '',
      credit: creditMatch ? creditMatch[1].split('\n')[0].replace(/[#*:]/g, '').trim() : '',
      amount: amountMatch ? amountMatch[1].trim() : '',
      narration: narrationMatch ? narrationMatch[1].split('\n')[0].replace(/[#*:]/g, '').trim() : '',
      items: itemsMatch ? itemsMatch[1].trim() : '',
      report: reportMatch ? reportMatch[1].split('\n')[0].replace(/[#*:]/g, '').trim() : '',
      gst: gstMatch ? gstMatch[1].trim() : '',
      payroll: payrollMatch ? payrollMatch[1].trim() : '',
    };
    
    console.log("Extracted Tally Info:", info);
    return info;
  }, [lastAssistantMessage]);

  return (
    <div className="flex h-[100dvh] bg-bg-main font-sans text-text-dark overflow-hidden">
      <Toaster position="bottom-right" />
      
      {(typeof process === 'undefined' || !process.env.GEMINI_API_KEY) && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center text-[10px] font-bold z-[100] animate-pulse uppercase tracking-widest">
          ⚠️ GEMINI_API_KEY is missing! Please add it in Settings to Secrets.
        </div>
      )}

      {/* Sidebar - Geometric Balance: Responsive width and visibility */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "bg-card border-r border-border/40 flex flex-col transition-all duration-300 z-[110] shadow-[10px_0_40px_rgba(0,0,0,0.02)]",
        "fixed inset-y-0 left-0 w-[85%] sm:w-80 md:relative md:w-80 md:translate-x-0 h-full",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-8 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-[18px] flex items-center justify-center shadow-xl shadow-tally-green/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Calculator className="w-6 h-6 text-accent-green" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-xl tracking-tighter uppercase serif-display leading-none">Accountant</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-tally-green/30 text-tally-green font-black tracking-widest uppercase bg-tally-green/5">Enterprise AI</Badge>
              </div>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-4 py-8">
          <div className="space-y-12">
            <div>
              <h2 className="px-5 mb-5 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">Navigation</h2>
              <div className="space-y-1 px-2">
                {[
                  { id: 'chat', label: 'AI Assistant', icon: MessageSquare, desc: 'Analyze & Record' },
                  { id: 'dashboard', label: 'Financial Hub', icon: LayoutDashboard, desc: 'Real-time Reports' },
                  { id: 'simulate', label: 'Tally Simulator', icon: Monitor, desc: 'Software Training' },
                ].map((item) => (
                  <Button 
                    key={item.id}
                    variant="ghost" 
                    className={cn(
                      "w-full justify-start gap-4 h-16 px-5 transition-all duration-300 rounded-2xl group relative overflow-hidden", 
                      activeTab === item.id 
                        ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/10" 
                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                  >
                    <item.icon className={cn("w-5 h-5 transition-transform duration-500", activeTab === item.id ? "scale-110 text-accent-green" : "group-hover:scale-110")} /> 
                    <div className="flex flex-col items-start transition-transform duration-300 group-hover:translate-x-1">
                      <span className="font-black text-[12px] uppercase tracking-wide">{item.label}</span>
                      <span className={cn("text-[9px] font-medium tracking-tight opacity-50", activeTab === item.id ? "text-accent-green/80" : "")}>{item.desc}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div className="px-4">
              <div className="pro-card p-6 bg-slate-950 border-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-tally-green/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                <GraduationCap className={cn("w-10 h-10 mb-5 text-accent-green transition-bounce", learningMode && "animate-bounce")} />
                <h3 className="text-white font-black text-xs uppercase tracking-widest mb-2">Learning Mode</h3>
                <p className="text-white/40 text-[10px] leading-relaxed mb-6 font-medium">Master professional accounting with expert AI guidance for every transaction.</p>
                
                <div 
                  onClick={() => setLearningMode(!learningMode)}
                  className={cn(
                    "w-14 h-7 rounded-full relative cursor-pointer transition-all duration-300",
                    learningMode ? "bg-accent-green shadow-[0_0_15px_rgba(0,130,80,0.4)]" : "bg-slate-800"
                  )}
                >
                  <motion.div 
                    animate={{ x: learningMode ? 30 : 4 }}
                    className="absolute top-1.5 w-4 h-4 bg-white rounded-full shadow-lg" 
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-border/40 space-y-6">
          {user && (
            <div className="flex items-center gap-4 p-4 pro-card bg-slate-50/50 dark:bg-slate-800/20 border-border/20">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-tally-green to-accent-green flex items-center justify-center text-white font-black text-sm uppercase shadow-xl shadow-tally-green/10 overflow-hidden border border-white/20">
                {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user.displayName?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tighter leading-none">{user.displayName}</div>
                <div className="text-[9px] font-bold text-slate-400 truncate tracking-widest mt-1.5 opacity-70 italic">{user.email}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="sm" onClick={() => setDarkMode(!darkMode)} className="h-11 rounded-2xl gap-2 font-black text-[9px] uppercase tracking-widest border-border/40 hover:bg-slate-50 dark:hover:bg-slate-800">
              {darkMode ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4 text-blue-400" />} {darkMode ? 'Day' : 'Night'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMessages([messages[0]])} className="h-11 rounded-2xl gap-2 font-black text-[9px] uppercase tracking-widest border-border/40 text-red-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100">
              <Trash2 className="w-4 h-4" /> Reset
            </Button>
          </div>
        </div>
      </aside>

      {/* Shortcuts Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-tally-green p-4 text-white flex justify-between items-center">
                <h3 className="font-bold uppercase tracking-widest">Tally Shortcuts</h3>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setShowShortcuts(false)}>
                  <Plus className="w-5 h-5 rotate-45" />
                </Button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['F1', 'Select Company'],
                    ['F2', 'Change Date'],
                    ['F4', 'Contra Voucher'],
                    ['F5', 'Payment Voucher'],
                    ['F6', 'Receipt Voucher'],
                    ['F7', 'Journal Voucher'],
                    ['F8', 'Sales Voucher'],
                    ['F9', 'Purchase Voucher'],
                    ['Alt + C', 'Create Ledger'],
                    ['Alt + A', 'Alter Master'],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex flex-col border-b border-gray-100 pb-2">
                      <span className="text-tally-green font-bold text-xs">{key}</span>
                      <span className="text-gray-600 text-[10px] uppercase font-bold">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-main overflow-hidden">
        {/* Header - Enterprise Standard */}
        <header className="shrink-0 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border/40 flex items-center justify-between px-6 md:px-12 z-[100] shadow-[0_1px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-tally-green">Active Session</span>
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse shadow-[0_0_8px_rgba(0,130,80,0.5)]" />
              </div>
              <h2 className="font-black text-xl tracking-tighter uppercase serif-display mt-0.5">
                {activeTab === 'chat' ? 'Transaction Intelligence' : activeTab === 'dashboard' ? 'Portfolio Analytics' : 'Terminal Simulation'}
              </h2>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-border/40">
            {[
              { id: 'chat', label: 'Analysis' },
              { id: 'dashboard', label: 'Reports' },
              { id: 'simulate', label: 'Terminal' }
            ].map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "h-9 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === tab.id 
                    ? "bg-white dark:bg-slate-900 text-tally-green shadow-xl shadow-slate-900/5 border border-border/20" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Local Engine</span>
              <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Status: Standalone</span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-border/50">
              <ShieldCheck className="w-5 h-5 text-tally-green" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-slate-50/30 dark:bg-slate-950/30">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col relative"
              >
                <div className="absolute inset-0 pointer-events-none overflow-hidden h-full w-full">
                  <div className="absolute top-[10%] left-[5%] w-[30%] h-[30%] bg-tally-green/5 blur-[120px] rounded-full" />
                  <div className="absolute bottom-[20%] right-[5%] w-[25%] h-[25%] bg-accent-green/5 blur-[100px] rounded-full" />
                </div>

                <ScrollArea ref={scrollAreaRef} className="flex-1 relative group overflow-hidden">
                  <div className="max-w-4xl mx-auto space-y-12 p-6 md:p-12 pb-48 md:pb-40">
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={cn(
                          "w-full flex flex-col relative",
                          message.role === 'user' ? "items-end" : "items-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[100%] md:max-w-[85%] group/bubble relative pro-card p-6 md:p-10",
                          message.role === 'user' 
                            ? "message-user border-none" 
                            : "message-ai border border-slate-200/50 dark:border-slate-800"
                        )}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-3 right-6 h-8 w-8 rounded-xl bg-white dark:bg-slate-800 border shadow-xl opacity-0 group-hover/bubble:opacity-100 transition-all z-10 hover:scale-110 active:scale-95"
                            onClick={() => toggleCollapse(message.id)}
                          >
                            {collapsedMessages.has(message.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                          </Button>
                          
                          {message.role === 'user' && (
                            <div className="flex items-center gap-3 mb-6 opacity-60">
                              <User className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Statement Analysis</span>
                            </div>
                          )}

                          {message.role === 'assistant' && (
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-tally-green overflow-hidden flex items-center justify-center p-1.5 shadow-lg shadow-tally-green/20">
                                  <Calculator className="w-full h-full text-accent-green" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200">Assistant Response</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Verified Calculation</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl text-slate-400 hover:text-tally-green hover:bg-slate-50 transition-all"
                                  onClick={() => copyToClipboard(message.content, message.id)}
                                >
                                  {copiedId === message.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl text-slate-400 hover:text-tally-green hover:bg-slate-50 transition-all"
                                  onClick={() => exportMessage(message.content)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}

                          <motion.div 
                            initial={false}
                            animate={{ height: collapsedMessages.has(message.id) ? 80 : 'auto' }}
                            className="overflow-hidden relative leading-relaxed"
                          >
                            {message.image && (
                              <div className="mb-8 p-1 bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden shadow-inner border border-border/50">
                                <img 
                                  src={message.image} 
                                  alt="Voucher" 
                                  className="rounded-[22px] w-full max-h-[500px] object-cover border border-white/10" 
                                  referrerPolicy="no-referrer"
                                />
                                <div className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-400 text-center">Reference Document Scanning</div>
                              </div>
                            )}
                            <div className={cn(
                              "prose prose-sm max-w-none dark:prose-invert",
                              message.role === 'user' ? "font-serif text-lg leading-snug" : ""
                            )}>
                              <ReactMarkdown 
                                components={{
                                  h3: ({node, ...props}) => (
                                    <h3 className="flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.2em] text-tally-green mt-10 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800" {...props} />
                                  ),
                                  ul: ({node, ...props}) => <ul className="list-none space-y-6 my-8 counter-reset-step" {...props} />,
                                  li: ({node, ...props}) => (
                                    <li className="text-[14px] font-medium text-slate-700 dark:text-slate-300 relative pl-12 mb-6 before:content-[counter(step)] before:counter-increment-step before:absolute before:left-0 before:top-0 before:w-8 before:h-8 before:bg-slate-50 dark:before:bg-slate-800/50 before:border before:border-slate-100 dark:before:border-slate-700 before:text-tally-green before:rounded-xl before:flex before:items-center before:justify-center before:text-[11px] before:font-black before:shadow-sm" {...props} />
                                  ),
                                  p: ({node, ...props}) => {
                                    const childrenString = String(props.children || '');
                                    if (childrenString.includes('Expert Insight')) {
                                      return (
                                        <div className="pro-card p-6 mt-10 bg-gradient-to-br from-green-50 to-white dark:from-slate-800/20 dark:to-slate-900 border-l-[6px] border-tally-green rounded-2xl shadow-sm">
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-full bg-tally-green/10 flex items-center justify-center">
                                              <Lightbulb className="w-4 h-4 text-tally-green" />
                                            </div>
                                            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-tally-green">Senior Auditor Review</span>
                                          </div>
                                          <div className="text-[13px] leading-relaxed italic text-slate-600 dark:text-slate-400 font-medium">{props.children}</div>
                                        </div>
                                      );
                                    }
                                    return <p className="m-0 leading-relaxed font-medium text-slate-600 dark:text-slate-400" {...props} />;
                                  }
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </motion.div>
                        </div>
                        {message.role === 'user' && (
                          <div className="mt-3 flex items-center gap-2 pr-2">
                             <CheckCheck className={cn("w-3.5 h-3.5", message.delivered ? "text-tally-green" : "text-slate-300")} />
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(), 'HH:mm')}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    <div ref={messagesEndRef} />
                    {isLoading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                           <div className="px-4 py-3 bg-white dark:bg-slate-900 pro-card flex items-center gap-3 shadow-xl">
                              <Loader2 className="w-4 h-4 text-tally-green animate-spin" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assistant is processing...</span>
                           </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full overflow-y-auto p-4 md:p-10 space-y-10"
              >
                <div className="max-w-7xl mx-auto space-y-10">
                  <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-tally-green rounded-full" />
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase serif-display">Financial Hub</h2>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] ml-5 italic">
                        Real-time analytics & automated ledger summaries
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl shadow-sm border border-border/50">
                      <Calendar className="w-4 h-4 text-tally-green" />
                      <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{format(new Date(), 'EEEE, MMMM do')}</span>
                    </div>
                  </header>

                  {/* Revenue Curve Chart */}
                  <Card className="pro-card p-6 md:p-8 bg-white dark:bg-slate-900 border-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-tally-green/5 blur-[100px] pointer-events-none" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Performance Analytics</h3>
                        <p className="text-2xl font-black serif-display text-slate-800 dark:text-white">Revenue vs Operating Payouts</p>
                      </div>
                      <div className="flex gap-6">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full bg-tally-green shadow-lg shadow-tally-green/20" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50 text-slate-500">Sales</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full bg-orange-400 shadow-lg shadow-orange-400/20" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50 text-slate-500">Expenses</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="h-[300px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#006041" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#006041" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fb923c" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000008" />
                          <XAxis 
                            dataKey="month" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                            dy={10}
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', background: '#fff' }}
                            labelStyle={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#006041" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorRevenue)" 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="expenses" 
                            stroke="#fb923c" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorExpenses)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Summary Metric Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                    {[
                      { label: 'Liquidity', val: `₹${stats.balance.toLocaleString()}`, icon: Wallet, color: 'emerald', sub: 'Calculated Cash & Bank' },
                      { label: 'Revenue', val: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'blue', sub: 'Monthly Gross Sales' },
                      { label: 'Payouts', val: `₹${stats.expenses.toLocaleString()}`, icon: TrendingDown, color: 'orange', sub: 'Total Direct Expenses' },
                      { label: 'Active Books', val: stats.recentCount, icon: BarChart3, color: 'slate', sub: 'Consolidated Vouchers' },
                    ].map((stat) => (
                      <Card key={stat.label} className="pro-card p-6 border-none group relative overflow-hidden bg-white dark:bg-slate-900 border-none shadow-sm hover:translate-y-[-4px]">
                        <div className={cn("absolute inset-y-0 left-0 w-1", `bg-${stat.color}-500/50`)} />
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", `bg-${stat.color}-500/10`)}>
                              <stat.icon className={cn("w-5 h-5", `text-${stat.color}-500`)} />
                            </div>
                            <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-100 dark:border-slate-800 tracking-widest opacity-50">{stat.label}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="text-3xl font-black tracking-tighter serif-display mono-data leading-none">
                              {stat.val}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{stat.sub}</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Live Daybook */}
                    <Card className="lg:col-span-8 pro-card overflow-hidden border-none shadow-xl bg-white dark:bg-slate-900">
                      <div className="p-8 border-b border-border/30 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center">
                            <FileText className="w-4 h-4 text-white dark:text-slate-900" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Live Daybook</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated Transaction Log</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl h-9 text-[10px] font-black uppercase tracking-widest border-border/50">Full Archive</Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50/30 dark:bg-slate-800/30">
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Timeline</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Class</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Narration</th>
                              <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Valuation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {vouchers.slice(0, 10).map((v) => (
                              <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                <td className="px-8 py-6">
                                  <div className="text-[11px] font-black text-slate-900 dark:text-slate-300 mono-data uppercase">
                                    {v.date ? format(new Date(v.date), 'dd MMM yyyy') : 'Pending Archive'}
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                  <Badge className={cn(
                                    "text-[9px] px-2 py-0.5 h-auto font-black uppercase tracking-[0.1em] rounded-md border shadow-sm",
                                    v.type === 'Payment' ? "bg-orange-50 text-orange-600 border-orange-200 shadow-orange-100" :
                                    v.type === 'Receipt' ? "bg-green-50 text-green-600 border-green-200 shadow-green-100" :
                                    v.type === 'Sales' ? "bg-blue-50 text-blue-600 border-blue-200 shadow-blue-100" :
                                    "bg-slate-50 text-slate-600 border-slate-200 shadow-slate-100"
                                  )}>
                                    {v.type}
                                  </Badge>
                                </td>
                                <td className="px-8 py-6">
                                  <p className="text-[12px] font-medium text-slate-500 max-w-[240px] truncate italic leading-relaxed">
                                    "{v.narration}"
                                  </p>
                                </td>
                                <td className="px-8 py-6 text-right">
                                  <span className="text-[13px] font-black text-slate-900 dark:text-white mono-data italic">
                                    ₹{v.totalAmount.toLocaleString()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {vouchers.length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-20 text-center">
                                  <div className="flex flex-col items-center gap-4 opacity-30">
                                    <Calculator className="w-12 h-12" />
                                    <p className="text-xs font-black uppercase tracking-widest">No entries in the digital daybook</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Chart of Accounts Summary */}
                    <Card className="lg:col-span-4 pro-card border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                      <div className="p-8 border-b border-border/30 bg-primary text-white">
                        <div className="flex items-center gap-3">
                          <History className="w-5 h-5 text-accent-green" />
                          <h3 className="text-sm font-black uppercase tracking-widest">Liquidity Pool</h3>
                        </div>
                      </div>
                      <ScrollArea className="h-[550px]">
                        <div className="p-6 space-y-4">
                          {ledgers.sort((a,b) => b.currentBalance - a.currentBalance).map(l => (
                            <div key={l.id} className="pro-card p-5 border border-slate-100 dark:border-slate-800 hover:border-tally-green transition-all group/ledger cursor-default">
                              <div className="flex items-center justify-between mb-3">
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-100 dark:border-slate-800 h-4 tracking-widest">{l.group}</Badge>
                                <span className={cn(
                                  "text-[10px] font-black mono-data",
                                  l.currentBalance >= 0 ? "text-green-500" : "text-red-500"
                                )}>
                                  {l.currentBalance >= 0 ? 'Surplus' : 'Deficit'}
                                </span>
                              </div>
                              <div className="flex items-end justify-between">
                                <span className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight group-hover/ledger:text-tally-green transition-colors">{l.name}</span>
                                <span className="text-lg font-black text-slate-900 dark:text-white serif-display tracking-tighter mono-data italic">
                                  ₹{l.currentBalance.toLocaleString()}
                                </span>
                              </div>
                              <div className="mt-3 h-1 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (Math.abs(l.currentBalance) / (stats.revenue || 1)) * 100)}%` }}
                                  className="h-full bg-tally-green"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'simulate' && (
              <motion.div 
                key="simulate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-full p-2 md:p-8 flex flex-col items-center justify-start md:justify-center bg-bg-main overflow-y-auto"
              >
                <div className="w-full max-w-4xl min-h-[500px] md:min-h-[600px] md:aspect-video bg-[#000080] rounded-lg shadow-2xl border-4 border-[#C0C0C0] overflow-hidden flex flex-col font-mono text-white relative my-4 md:my-0 transform-gpu transition-transform origin-top tally-sim-screen">
                              <div className="bg-[#C0C0C0] text-black px-2 md:px-4 py-1.5 md:py-2 flex justify-between text-[11px] md:text-sm font-black border-b-4 border-black/40 shadow-xl relative z-10">
                                <span className="tracking-[0.3em] flex items-center gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-tally-green rounded-full shadow-inner" /> TALLYPRIME</span>
                                <div className="flex gap-2 md:gap-6 items-center">
                                  <span className="hover:text-tally-green cursor-pointer transition-colors text-[10px] md:text-xs bg-black/10 px-2 py-0.5 rounded">P: Print</span>
                                  <span className="hover:text-tally-green cursor-pointer transition-colors text-[10px] md:text-xs bg-black/10 px-2 py-0.5 rounded">E: Export</span>
                                  <span className="hover:text-tally-green cursor-pointer transition-colors hidden sm:bg-black/10 sm:px-2 sm:py-0.5 sm:rounded">M: E-Mail</span>
                                </div>
                              </div>
                  
                  {/* Tally Main Area */}
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Sidebar */}
                    <div className="w-full md:w-1/4 border-b md:border-b-0 md:border-r border-white/20 p-2 md:p-4 space-y-2 md:space-y-4 bg-[#000066]">
                      <div className="flex md:block justify-between items-center">
                        <div>
                          <div className="text-yellow-400 text-[10px] md:text-xs underline uppercase font-black tracking-widest">Current Period</div>
                          <div className="text-[11px] md:text-sm font-bold text-white/90">1-Apr-26 to 31-Mar-27</div>
                        </div>
                        <div className="md:mt-6">
                          <div className="text-yellow-400 text-[10px] md:text-xs underline uppercase font-black tracking-widest">Current Date</div>
                          <div className="text-[11px] md:text-sm font-bold text-white/90">16 Apr, 2026</div>
                        </div>
                      </div>
                      
                      <div className="hidden md:block mt-10 pt-6 border-t-2 border-white/20">
                        <div className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-2">Selected Company</div>
                        <div className="text-sm md:text-base font-black text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">My Business Pvt Ltd</div>
                      </div>
                    </div>
                    
                    {/* Main Content */}
                    <div className="flex-1 flex flex-col relative overflow-y-auto">
                      {simView === 'gateway' ? (
                        <div className="flex-1 flex flex-col items-center pt-6 md:pt-12 pb-6">
                          <div className="text-yellow-400 text-lg md:text-2xl font-black mb-6 md:mb-12 tracking-[0.4em] drop-shadow-lg uppercase">Gateway of Tally</div>
                          <div className="w-[90%] md:w-96 border-4 border-white/40 p-0 bg-[#000080] shadow-2xl">
                            <div className="bg-[#000044] text-center text-[11px] md:text-sm font-black py-2 border-b-2 border-white/20 tracking-widest uppercase">Masters</div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Create</span> <span className="text-yellow-400 font-bold">C</span></div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Alter</span> <span className="text-yellow-400 font-bold">A</span></div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Chart of Accounts</span> <span className="text-yellow-400 font-bold">H</span></div>
                            
                            <div className="bg-[#000044] text-center text-[11px] md:text-sm font-black py-2 border-b-2 border-t-2 border-white/20 mt-3 tracking-widest uppercase">Transactions</div>
                            <div 
                              onClick={() => setSimView('voucher')}
                              className={cn("px-6 py-2 flex justify-between cursor-pointer text-sm md:text-base transition-all", !tallyInfo?.report ? "bg-yellow-400 text-blue-900 font-black shadow-lg scale-[1.02] z-10" : "hover:bg-white/10")}
                            >
                              <span>Vouchers</span> <span className={cn(!tallyInfo?.report ? "text-blue-900" : "text-yellow-400 font-bold")}>V</span>
                            </div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Day Book</span> <span className="text-yellow-400 font-bold">K</span></div>
                            
                            <div className="bg-[#000044] text-center text-[11px] md:text-sm font-black py-2 border-b-2 border-t-2 border-white/20 mt-3 tracking-widest uppercase">Utilities</div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Banking</span> <span className="text-yellow-400 font-bold">N</span></div>
                            
                            <div className="bg-[#000044] text-center text-[11px] md:text-sm font-black py-2 border-b-2 border-t-2 border-white/20 mt-3 tracking-widest uppercase">Reports</div>
                            <div 
                              onClick={() => setSimView('report')}
                              className={cn("px-6 py-2 flex justify-between cursor-pointer text-sm md:text-base transition-all", tallyInfo?.report ? "bg-yellow-400 text-blue-900 font-black shadow-lg scale-[1.02] z-10" : "hover:bg-white/10")}
                            >
                              <span>{tallyInfo?.report || 'Balance Sheet'}</span> <span className={cn(tallyInfo?.report ? "text-blue-900" : "text-yellow-400 font-bold")}>B</span>
                            </div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Profit & Loss A/c</span> <span className="text-yellow-400 font-bold">P</span></div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Stock Summary</span> <span className="text-yellow-400 font-bold">S</span></div>
                            <div className="px-6 py-2 flex justify-between hover:bg-white/10 cursor-pointer text-sm md:text-base transition-colors"><span>Ratio Analysis</span> <span className="text-yellow-400 font-bold">R</span></div>
                            
                            <div className="bg-[#000044] text-center text-[11px] md:text-sm font-black py-2 border-b-2 border-t-2 border-white/20 mt-3 tracking-widest uppercase">Quit</div>
                            <div className="px-6 py-2 flex justify-between hover:bg-yellow-400 hover:text-blue-900 group cursor-pointer text-sm md:text-base transition-colors"><span>Quit</span> <span className="text-yellow-400 group-hover:text-blue-900 font-bold">Q</span></div>
                          </div>
                          
                          <div className="flex-1 hidden md:flex items-center justify-center pointer-events-none opacity-20 transform -rotate-12 select-none">
                            <div className="text-[120px] font-black tracking-[0.5em] text-white">TALLY</div>
                          </div>
                        </div>
                      ) : simView === 'voucher' ? (
                        <div className="flex-1 flex flex-col p-2 md:p-4">
                          <div className="flex justify-between items-center border-b border-white/20 pb-1 md:pb-2 mb-2 md:mb-4">
                            <div className="flex items-center gap-2 md:gap-4">
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 md:h-10 text-[10px] md:text-xs bg-white/20 hover:bg-white/30 text-white px-3 md:px-4 font-bold border border-white/30 transition-all active:scale-95"
                                onClick={() => setSimView('gateway')}
                              >
                                ← ESC: GATEWAY
                              </Button>
                              <span className="text-yellow-400 font-black uppercase text-[12px] md:text-lg tracking-[0.3em] drop-shadow-md">Voucher Creation</span>
                            </div>
                          </div>
                          
                          <ScrollArea className="flex-1 bg-[#000066] p-3 md:p-6 border border-white/10 rounded shadow-inner">
                            <div className="flex justify-between mb-4 md:mb-8 px-2">
                              <div className="bg-yellow-400 text-blue-900 px-4 md:px-8 py-1 md:py-2 font-black text-[12px] md:text-lg shadow-lg border-2 border-white/20 uppercase tracking-widest">
                                {tallyInfo?.voucher || 'Payment'}
                              </div>
                              <div className="text-[10px] md:text-sm">16-Apr-26</div>
                            </div>
                            
                            <div className="space-y-4 md:space-y-6">
                              <div className="flex items-center gap-2 md:gap-4 border-b-4 border-white/30 pb-3 md:pb-4 mb-6">
                                <span className="w-12 md:w-20 text-[11px] md:text-sm text-yellow-400 font-black uppercase tracking-[0.2em] text-center">Partic.</span>
                                <span className="flex-1 text-[11px] md:text-sm text-yellow-400 font-black uppercase tracking-[0.2em] px-4">Particulars / Ledger Name</span>
                                <span className="w-20 md:w-32 text-right text-[11px] md:text-sm text-yellow-400 font-black uppercase tracking-[0.2em]">Amount (₹)</span>
                              </div>
                              
                              <div className="flex items-center gap-2 md:gap-4">
                                <span className="w-12 md:w-20 text-[12px] md:text-lg font-black text-yellow-400 text-center border-r border-white/10 uppercase">DR</span>
                                <div className="flex-1 flex flex-col">
                                  <span className="text-[12px] md:text-lg font-bold text-white bg-blue-900/90 px-5 py-3 rounded-lg border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.2)] truncate uppercase tracking-widest min-h-[50px] flex items-center justify-center">
                                    {tallyInfo?.debit || 'Select Debit Ledger...'}
                                  </span>
                                </div>
                                <span className="w-20 md:w-32 text-right text-[12px] md:text-lg font-black text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.4)]">₹{tallyInfo?.amount || '0.00'}</span>
                              </div>
                              
                              {tallyInfo?.items && (
                                <div className="ml-12 md:ml-24 p-3 md:p-4 bg-black/40 border-l-4 border-yellow-400/50 rounded-r-lg space-y-2 md:space-y-3 shadow-inner">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                                    <div className="text-[10px] md:text-xs text-yellow-400 font-black uppercase tracking-[0.2em]">Inventory Details</div>
                                  </div>
                                  <div className="text-[11px] md:text-sm text-white/90 whitespace-pre-line font-mono leading-relaxed">
                                    {tallyInfo.items}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 md:gap-4">
                                <span className="w-12 md:w-20 text-[12px] md:text-lg font-black text-yellow-400 text-center border-r border-white/10 uppercase">CR</span>
                                <div className="flex-1 flex flex-col">
                                  <span className="text-[12px] md:text-lg font-bold text-white bg-blue-900/90 px-5 py-3 rounded-lg border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.2)] truncate uppercase tracking-widest min-h-[50px] flex items-center justify-center">
                                    {tallyInfo?.credit || 'Select Credit Ledger...'}
                                  </span>
                                </div>
                                <span className="w-20 md:w-32 text-right text-[12px] md:text-lg font-black text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.4)]">₹{tallyInfo?.amount || '0.00'}</span>
                              </div>
                            </div>
                            
                            <div className="mt-10 md:mt-16 pt-6 md:pt-8 border-t-4 border-white/30">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                                <div className="text-[11px] md:text-sm text-yellow-400 font-black uppercase tracking-[0.3em]">Narration</div>
                              </div>
                              <div className="text-[12px] md:text-base italic text-white bg-black/50 p-5 rounded-xl border-2 border-white/10 shadow-2xl leading-relaxed min-h-[80px] flex items-center">
                                {tallyInfo?.narration ? (
                                  <span className="opacity-100 drop-shadow-sm">Being {tallyInfo.narration}</span>
                                ) : (
                                  <span className="opacity-30">Being {tallyInfo?.voucher.toLowerCase()} entry recorded in books of accounts...</span>
                                )}
                              </div>
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col p-2 md:p-4">
                          <div className="flex justify-between items-center border-b border-white/20 pb-1 md:pb-2 mb-2 md:mb-4">
                            <div className="flex items-center gap-2 md:gap-4">
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 md:h-10 text-[10px] md:text-xs bg-white/20 hover:bg-white/30 text-white px-3 md:px-4 font-bold border border-white/30 transition-all active:scale-95"
                                onClick={() => setSimView('gateway')}
                              >
                                ← ESC: GATEWAY
                              </Button>
                              <span className="text-yellow-400 font-bold uppercase text-[10px] md:text-sm">{tallyInfo?.report || 'Report'}</span>
                            </div>
                          </div>
                          
                          <ScrollArea className="flex-1 bg-white text-black p-3 md:p-6 border border-black/10 rounded shadow-xl font-sans">
                            <div className="text-center border-b-2 border-black pb-2 md:pb-4 mb-4 md:mb-6">
                              <div className="text-sm md:text-lg font-bold uppercase">My Business Pvt Ltd</div>
                              <div className="text-sm font-bold">{tallyInfo?.report || 'Financial Statement'}</div>
                            </div>
                            
                            {/* Dynamic Report Content */}
                            {tallyInfo?.report?.toLowerCase().includes('gst') || tallyInfo?.gst ? (
                              <div className="space-y-4">
                                <div className="bg-blue-50 p-3 border border-blue-200 rounded">
                                  <h4 className="text-xs font-bold text-blue-800 uppercase mb-2">GST Summary / Return</h4>
                                  <div className="text-[10px] text-blue-700 whitespace-pre-line font-mono">
                                    {tallyInfo?.gst || 'This report shows your GST liability and Input Tax Credit (ITC) details.'}
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-0 border-2 border-black text-[11px] md:text-sm">
                                  <div className="border-r-2 border-black p-3 font-black bg-gray-100 uppercase tracking-wider">Tax Type</div>
                                  <div className="border-r-2 border-black p-3 font-black bg-gray-100 text-right uppercase tracking-wider">Output Tax</div>
                                  <div className="p-3 font-black bg-gray-100 text-right uppercase tracking-wider">Input Tax (ITC)</div>
                                  
                                  <div className="border-t-2 border-r-2 border-black p-3 font-bold">CGST</div>
                                  <div className="border-t-2 border-r-2 border-black p-3 text-right">0.00</div>
                                  <div className="border-t-2 border-black p-3 text-right">0.00</div>
                                  
                                  <div className="border-t-2 border-r-2 border-black p-3 font-bold">SGST</div>
                                  <div className="border-t-2 border-r-2 border-black p-3 text-right">0.00</div>
                                  <div className="border-t-2 border-black p-3 text-right">0.00</div>
                                  
                                  <div className="border-t-2 border-r-2 border-black p-3 font-black bg-gray-50">Total Tax</div>
                                  <div className="border-t-2 border-r-2 border-black p-3 font-black bg-gray-50 text-right">0.00</div>
                                  <div className="border-t-2 border-black p-3 font-black bg-gray-50 text-right">0.00</div>
                                </div>
                              </div>
                            ) : tallyInfo?.report?.toLowerCase().includes('salary') || tallyInfo?.report?.toLowerCase().includes('pay') || tallyInfo?.payroll ? (
                              <div className="space-y-4">
                                <div className="bg-green-50 p-3 border border-green-200 rounded">
                                  <h4 className="text-xs font-bold text-green-800 uppercase mb-2">Pay Slip / Payroll Details</h4>
                                  <div className="text-[10px] text-green-700 whitespace-pre-line font-mono">
                                    {tallyInfo?.payroll || 'This shows the earnings and deductions for the employee.'}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-0 border-2 border-black text-[11px] md:text-sm">
                                  <div className="border-r-2 border-black p-3 font-black bg-gray-100 uppercase tracking-wider">Earnings</div>
                                  <div className="p-3 font-black bg-gray-100 text-right uppercase tracking-wider">Deductions</div>
                                  
                                  <div className="border-t-2 border-r-2 border-black p-3 font-bold">Basic Salary</div>
                                  <div className="border-t-2 border-black p-3 text-right">PF Contribution</div>
                                  
                                  <div className="border-t-2 border-r-2 border-black p-3 font-bold">HRA</div>
                                  <div className="border-t-2 border-black p-3 text-right">ESI</div>
                                  
                                  <div className="border-t-2 border-r-2 border-black p-3 font-black text-blue-900 bg-gray-50">Gross Earnings</div>
                                  <div className="border-t-2 border-black p-3 font-black text-red-900 text-right bg-gray-50">Total Deductions</div>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-0 border-2 border-black text-[11px] md:text-sm">
                                <div className="border-r-2 border-black p-3 font-black bg-gray-100 uppercase tracking-wider">Liabilities</div>
                                <div className="p-3 font-black bg-gray-100 text-right uppercase tracking-wider">Amount</div>
                                
                                <div className="border-t-2 border-r-2 border-black p-3 font-bold">Capital Account</div>
                                <div className="border-t-2 border-black p-3 text-right">10,00,000.00</div>
                                
                                <div className="border-t-2 border-r-2 border-black p-3 font-bold">Loans (Liability)</div>
                                <div className="border-t-2 border-black p-3 text-right">0.00</div>
                                
                                <div className="border-t-2 border-r-2 border-black p-3 font-bold">Current Liabilities</div>
                                <div className="border-t-2 border-black p-3 text-right">0.00</div>
                                
                                <div className="border-t-2 border-r-2 border-black p-3 font-black bg-gray-50 uppercase tracking-widest">Total</div>
                                <div className="border-t-2 border-black p-3 font-black bg-gray-50 text-right">10,00,000.00</div>
                              </div>
                            )}
                            
                            {/* Narration in Report View */}
                            <div className="mt-6 pt-4 border-t border-slate-200">
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Expert Commentary</div>
                              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 italic">
                                {tallyInfo?.narration ? (
                                  <span>Note: {tallyInfo.narration}</span>
                                ) : (
                                  <span className="opacity-50">Viewing {tallyInfo?.report || 'Financial Statement'}...</span>
                                )}
                              </div>
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Tally Footer */}
                  <div className="bg-[#C0C0C0] text-black px-2 md:px-4 py-1 md:py-2 flex justify-between text-[10px] md:text-xs font-black border-t-2 border-black/30 shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
                    <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar">
                      <span className={cn("px-2 py-0.5 rounded shadow-sm shrink-0", tallyInfo?.voucher.includes('Contra') ? "bg-yellow-400 border border-black/20" : "bg-black text-white")}>F4: Contra</span>
                      <span className={cn("px-2 py-0.5 rounded shadow-sm shrink-0", tallyInfo?.voucher.includes('Payment') ? "bg-yellow-400 border border-black/20" : "bg-black text-white")}>F5: Pay</span>
                      <span className={cn("px-2 py-0.5 rounded shadow-sm shrink-0", tallyInfo?.voucher.includes('Receipt') ? "bg-yellow-400 border border-black/20" : "bg-black text-white")}>F6: Rec</span>
                      <span className={cn("px-2 py-0.5 rounded shadow-sm shrink-0", tallyInfo?.voucher.includes('Sales') ? "bg-yellow-400 border border-black/20" : "bg-black text-white")}>F8: Sales</span>
                      <span className={cn("px-2 py-0.5 rounded shadow-sm shrink-0", tallyInfo?.voucher.includes('Purchase') ? "bg-yellow-400 border border-black/20" : "bg-black text-white")}>F9: Purc</span>
                    </div>
                    <span className="shrink-0 ml-4 opacity-70 tracking-widest">TALLYPRIME v4.0</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area - Floating Terminal Style */}
        <div className="shrink-0 p-6 md:p-10 z-[110] relative">
          <div className="max-w-4xl mx-auto">
            {selectedImage && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 relative inline-block group"
              >
                <div className="absolute -inset-2 bg-gradient-to-r from-tally-green to-accent-green rounded-[24px] blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="h-24 w-24 object-cover rounded-2xl border-2 border-white dark:border-slate-800 shadow-2xl relative" 
                  referrerPolicy="no-referrer"
                />
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute -top-3 -right-3 h-8 w-8 rounded-full shadow-2xl border-2 border-white dark:border-slate-900 transition-transform hover:scale-110 active:scale-90"
                  onClick={() => setSelectedImage(null)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
            
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-3 mb-6 justify-start pb-2">
              {['Paid 5000 Rent', 'Sold Goods 10000', 'Salary 25000', 'GST Report', 'Balance Sheet'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInput(chip)}
                  className="text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 bg-white dark:bg-slate-900 border border-border/40 rounded-xl hover:border-tally-green hover:bg-tally-green/5 hover:text-tally-green transition-all active:scale-95 shrink-0 whitespace-nowrap shadow-sm"
                >
                  {chip}
                </button>
              ))}
            </div>
            
            <div className="relative group p-1 bg-white dark:bg-slate-900 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-border/40 transition-all focus-within:shadow-[0_20px_70px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-2xl text-slate-400 hover:text-tally-green hover:bg-slate-50 dark:hover:bg-slate-800 h-12 w-12 md:h-14 md:w-14"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("rounded-2xl h-12 w-12 md:h-14 md:w-14 hidden sm:flex transition-colors", isListening ? "text-red-500 bg-red-50 dark:bg-red-950 animate-pulse" : "text-slate-400 hover:text-tally-green hover:bg-slate-50 dark:hover:bg-slate-800")}
                  onClick={startListening}
                >
                  <Mic className="w-5 h-5" />
                </Button>
                
                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-2" />
                
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask your enterprise assistant anything..." 
                  className="flex-1 border-none shadow-none focus-visible:ring-0 text-sm md:text-base placeholder:text-slate-300 font-medium h-12 md:h-14 bg-transparent pl-2"
                />
                
                <Button 
                  size="lg"
                  className="bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-white font-black uppercase tracking-[0.15em] px-8 h-12 md:h-14 rounded-[22px] shadow-2xl transition-all hover:translate-x-1 active:scale-95 disabled:opacity-50"
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  <span className="hidden md:inline ml-3 text-[11px]">Sync Now</span>
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center items-center gap-12 mt-8 opacity-40">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-tally-green rounded-full shadow-[0_0_8px_rgba(0,130,80,1)]" />
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.3em]">End-to-End Encryption</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.3em]">AI Model: Gemini 1.5 Pro</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
