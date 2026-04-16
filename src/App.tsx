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
  Moon
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'नमस्ते! मैं आपका Tally AI Assistant हूँ। आप मुझे कोई भी transaction बता सकते हैं या voucher की फोटो भेज सकते हैं, और मैं आपको step-by-step Tally entry सिखाऊँगा।\n\nउदाहरण के लिए: "Paid ₹5000 rent in cash"\n\n**Tip:** Entry को live देखने के लिए ऊपर "Simulation" tab पर क्लिक करें!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [learningMode, setLearningMode] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());

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

  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') || 
                     scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') || 
                     scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
      <Toaster position="top-center" />
      
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
        "bg-card border-r border-border flex flex-col transition-all duration-300 z-[110] shadow-2xl overflow-hidden shadow-[10px_0_30px_rgba(0,0,0,0.1)]",
        "fixed inset-y-0 left-0 w-[85%] sm:w-72 md:relative md:w-72 md:translate-x-0 h-full",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-border-theme bg-tally-green text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-8 h-8 text-accent-green" />
              <h1 className="font-bold text-xl tracking-wider uppercase">Tally AI</h1>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden text-white"
              onClick={() => setIsSidebarOpen(false)}
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
          <p className="text-[10px] text-white/70 mt-1 uppercase tracking-widest font-bold">Accounting Companion</p>
        </div>
        
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-8">
            <div>
              <h2 className="card-title-bar px-2 mb-3">Accounting Menu</h2>
              <div className="space-y-1.5 px-1">
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 h-11 px-3 font-black text-[11px] uppercase tracking-wider transition-all duration-200 rounded-md hover:bg-bg-main", 
                    activeTab === 'chat' ? "bg-bg-main text-tally-green border-r-4 border-tally-green shadow-sm" : "text-text-muted"
                  )}
                  onClick={() => {
                    setActiveTab('chat');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                >
                  <MessageSquare className="w-4 h-4" /> Transactions
                </Button>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 h-11 px-3 font-black text-[11px] uppercase tracking-wider transition-all duration-200 rounded-md hover:bg-bg-main", 
                    activeTab === 'simulate' ? "bg-bg-main text-tally-green border-r-4 border-tally-green shadow-sm" : "text-text-muted"
                  )}
                  onClick={() => {
                    setActiveTab('simulate');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                >
                  <LayoutDashboard className="w-4 h-4" /> Simulation View
                </Button>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 h-11 px-3 font-black text-[11px] uppercase tracking-wider transition-all duration-200 rounded-md hover:bg-bg-main", 
                    learningMode ? "text-tally-green bg-green-50" : "text-text-muted"
                  )}
                  onClick={() => setLearningMode(!learningMode)}
                >
                  <GraduationCap className={cn("w-4 h-4", learningMode && "animate-bounce")} /> Learning Mode: {learningMode ? 'ON' : 'OFF'}
                </Button>
              </div>
            </div>

            <div>
              <h2 className="card-title-bar px-2 mb-3">Recent Vouchers</h2>
              <div className="space-y-2 px-3">
                {messages.filter(m => m.role === 'user').slice(-5).map(m => (
                  <div key={m.id} className="text-[12px] text-text-muted truncate hover:text-tally-green cursor-pointer transition-colors flex items-center gap-3 font-bold group">
                    <FileText className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:text-tally-green transition-all" />
                    <span className="truncate">{m.content || "Image Voucher"}</span>
                  </div>
                ))}
                {messages.filter(m => m.role === 'user').length === 0 && (
                  <div className="text-[11px] text-text-muted/50 italic px-2">No recent entries</div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border-theme space-y-1 bg-gray-50/50">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 h-10 text-text-muted text-[10px] font-black uppercase tracking-widest hover:text-red-600 transition-colors" 
            onClick={clearHistory}
          >
            <Trash2 className="w-4 h-4" /> Reset History
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 h-10 text-text-muted text-[10px] font-black uppercase tracking-widest hover:text-tally-green transition-colors"
          >
            <Settings className="w-4 h-4" /> AI Preferences
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-11 mt-2 text-[11px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border-2 border-tally-green/10 hover:border-tally-green hover:text-tally-green transition-all active:scale-95 shadow-sm"
            onClick={() => setShowShortcuts(true)}
          >
            <Keyboard className="w-4 h-4" /> Tally Keys
          </Button>

          <Button 
            variant="ghost" 
            className="w-full justify-between items-center h-10 px-3 mt-2 text-text-muted text-[10px] font-black uppercase tracking-widest hover:bg-bg-main"
            onClick={() => setDarkMode(!darkMode)}
          >
            <div className="flex items-center gap-3">
              {darkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-blue-500" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div className={cn("w-8 h-4 rounded-full relative transition-colors", darkMode ? "bg-tally-green" : "bg-slate-300 dark:bg-slate-600")}>
              <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-md", darkMode ? "left-[18px]" : "left-0.5")} />
            </div>
          </Button>
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
        {/* Header - Geometric Balance: Green with accent border */}
        <header className="shrink-0 h-14 md:h-16 bg-tally-green border-b-4 border-accent-green flex items-center justify-between px-3 md:px-6 z-20 text-white shadow-md">
          <div className="flex items-center gap-2 md:gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10 h-9 w-9"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 md:w-6 md:h-6" />
            </Button>
            <div className="flex flex-col">
              <h2 className="font-bold text-sm md:text-lg leading-none tracking-wide uppercase">Tally AI</h2>
              <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse" />
                <span className="text-[8px] md:text-[10px] text-white/80 font-bold uppercase tracking-widest">Live</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex">
                <TabsList className="bg-black/30 p-0.5 h-8 md:h-9 border border-white/10">
                  <TabsTrigger value="chat" className="rounded-sm px-2.5 md:px-4 text-[10px] md:text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-tally-green transition-all">CHAT</TabsTrigger>
                  <TabsTrigger value="simulate" className="rounded-sm px-2.5 md:px-4 text-[10px] md:text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-tally-green transition-all">SIM</TabsTrigger>
                </TabsList>
              </Tabs>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' ? (
              <motion.div 
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col"
              >
                <ScrollArea ref={scrollAreaRef} className="flex-1 relative group bg-bg-main overflow-hidden">
                  <div className="max-w-4xl mx-auto space-y-4 md:space-y-8 p-4 md:p-8 pb-48 md:pb-32">
                    {messages.map((message, index) => {
                      console.log(`Rendering message ${index}:`, message.role, "Length:", message.content.length);
                      return (
                        <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "w-full flex flex-col",
                          message.role === 'user' ? "items-end" : "items-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[100%] md:max-w-[90%] rounded-3xl px-4 py-4 md:px-6 md:py-6 shadow-md border group/bubble relative",
                          message.role === 'user' 
                            ? "bg-card border-border text-foreground italic ml-auto rounded-tr-none shadow-sm" 
                            : "bg-card border-border text-foreground mr-auto rounded-tl-none shadow-sm"
                        )}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-3 right-4 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover/bubble:opacity-100 transition-opacity z-10"
                            onClick={() => toggleCollapse(message.id)}
                          >
                            {collapsedMessages.has(message.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                          </Button>
                          {message.role === 'user' && (
                            <div className="card-title-bar">User Input</div>
                          )}
                          {message.role === 'assistant' && (
                            <div className="flex items-center justify-between mb-3 md:mb-6 pb-2 md:pb-3 border-b-2 border-border/50">
                              <div className="card-title-bar mb-0 border-none pb-0">Detailed Tally Analysis</div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-400 hover:text-tally-green"
                                  onClick={() => copyToClipboard(message.content, message.id)}
                                >
                                  {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-400 hover:text-tally-green"
                                  onClick={() => exportMessage(message.content)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <motion.div 
                            initial={false}
                            animate={{ height: collapsedMessages.has(message.id) ? 60 : 'auto' }}
                            className="overflow-hidden relative"
                          >
                            {message.image && (
                              <div className="mb-4">
                                <div className="card-title-bar">Attached Voucher</div>
                                <img 
                                  src={message.image} 
                                  alt="Voucher" 
                                  className="rounded-md max-h-80 object-cover border border-border-theme" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown 
                                components={{
                                  h3: ({node, ...props}) => (
                                    <h3 className="flex items-center gap-2 text-[11px] md:text-[12px] font-bold uppercase tracking-widest text-tally-green mt-4 md:mt-8 mb-2 md:mb-4 border-b border-tally-green/10 pb-2" {...props} />
                                  ),
                                  ul: ({node, ...props}) => <ul className="list-none space-y-2 md:space-y-4 my-4 md:my-6 counter-reset-step" {...props} />,
                                  li: ({node, ...props}) => (
                                    <li className="text-[13px] md:text-[14px] relative pl-8 md:pl-10 mb-2 md:mb-4 before:content-[counter(step)] before:counter-increment-step before:absolute before:left-0 before:top-0.5 before:w-6 before:h-6 md:w-7 md:h-7 before:bg-tally-green/10 before:border-2 before:border-tally-green before:text-tally-green before:rounded-sm before:flex before:items-center before:justify-center before:text-[10px] md:text-[11px] before:font-black before:shadow-[2px_2px_0_rgba(0,96,65,0.2)]" {...props} />
                                  ),
                                  p: ({node, ...props}) => {
                                    const childrenString = String(props.children || '');
                                    if (childrenString.includes('Why this entry') || childrenString.includes('Why this is important')) {
                                      return (
                                        <div className="learning-mode-box mt-6 border-l-4 border-tally-green bg-green-50/50">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Lightbulb className="w-4 h-4 text-tally-green" />
                                            <strong className="text-tally-green uppercase tracking-wider text-[11px]">Expert Insight</strong>
                                          </div>
                                          <div className="text-[13px] leading-relaxed m-0 text-foreground/80">{props.children}</div>
                                        </div>
                                      );
                                    }
                                    if (childrenString.includes('Important Notes for Beginners')) {
                                      return (
                                        <div className="mt-6 border-l-4 border-blue-500 bg-blue-500/10 p-5 rounded-r-lg shadow-sm">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Info className="w-4 h-4 text-blue-500" />
                                            <strong className="text-blue-500 uppercase tracking-wider text-[11px]">Beginner's Guide</strong>
                                          </div>
                                          <div className="text-[13px] leading-relaxed m-0 text-foreground/80">{props.children}</div>
                                        </div>
                                      );
                                    }
                                    return <p className="text-[16px] md:text-[18px] leading-[1.8] my-4 text-foreground/90 font-medium transition-colors" {...props} />;
                                  },
                                  strong: ({node, ...props}) => <strong className="font-bold text-tally-green" {...props} />,
                                  table: ({node, ...props}) => (
                                    <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 shadow-sm">
                                      <table className="w-full border-collapse bg-white dark:bg-slate-900" {...props} />
                                    </div>
                                  ),
                                  th: ({node, ...props}) => <th className="text-left text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 p-3 border-b border-border font-bold bg-muted" {...props} />,
                                  td: ({node, ...props}) => {
                                    const content = props.children?.toString() || '';
                                    if (content.toLowerCase() === 'debit') {
                                      return <td className="p-3 border-b border-border text-sm font-bold text-green-700 bg-green-50/30">Debit</td>;
                                    }
                                    if (content.toLowerCase() === 'credit') {
                                      return <td className="p-3 border-b border-border text-sm font-bold text-red-700 bg-red-50/30">Credit</td>;
                                    }
                                    return <td className="p-3 border-b border-border text-sm text-foreground/70" {...props} />;
                                  },
                                  code: ({node, ...props}) => <span className="path-display my-4 block">{props.children}</span>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            {collapsedMessages.has(message.id) && (
                              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                            )}
                          </motion.div>
                          
                          <div className={cn(
                            "flex items-center gap-1.5 mt-2",
                            message.role === 'user' ? "justify-end" : "justify-start"
                          )}>
                            <span className="text-[10px] text-text-muted opacity-60">
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {message.role === 'user' && (
                              <div className="flex items-center text-tally-green">
                                <CheckCheck className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </div>
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                    {isLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex items-center gap-2 text-tally-green text-sm font-bold uppercase tracking-widest"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Floating Scroll Buttons */}
                  <div className="fixed bottom-40 md:bottom-32 right-3 md:right-12 flex flex-col gap-2 md:gap-3 z-[40] transition-opacity">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="rounded-full shadow-2xl bg-white border-2 border-tally-green/20 h-9 w-9 md:h-12 md:w-12 text-tally-green hover:bg-tally-green hover:text-white transition-all active:scale-95"
                      onClick={scrollToTop}
                      title="Scroll to Top"
                    >
                      <ArrowUp className="w-5 h-5 md:w-6 md:h-6" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="rounded-full shadow-2xl bg-white border-2 border-tally-green/20 h-9 w-9 md:h-12 md:w-12 text-tally-green hover:bg-tally-green hover:text-white transition-all active:scale-95"
                      onClick={scrollToBottom}
                      title="Scroll to Bottom"
                    >
                      <ArrowDown className="w-5 h-5 md:w-6 md:h-6" />
                    </Button>
                  </div>
                </ScrollArea>
              </motion.div>
            ) : (
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

        {/* Input Area */}
        <div className="shrink-0 p-2 md:p-8 bg-card border-t-2 border-border z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] theme-transition">
          <div className="max-w-4xl mx-auto">
            {selectedImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-3 relative inline-block"
              >
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="h-20 w-20 object-cover rounded-md border-2 border-tally-green shadow-md" 
                  referrerPolicy="no-referrer"
                />
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md"
                  onClick={() => setSelectedImage(null)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </motion.div>
            )}
            
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 mb-4 justify-start pb-1">
              {['Paid 5000 Rent', 'Sold Goods 10000', 'Salary 25000', 'GST Report', 'Balance Sheet'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInput(chip)}
                  className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 bg-bg-main border border-border-theme rounded-md hover:border-tally-green hover:bg-tally-green hover:text-white transition-all active:scale-95 shrink-0 whitespace-nowrap"
                >
                  {chip}
                </button>
              ))}
            </div>
            
            <div className="relative flex items-center gap-1 md:gap-2 bg-muted rounded-md border-2 border-border p-1 md:p-1.5 pr-2 md:pr-4 shadow-inner">
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
                className="rounded-md text-text-muted hover:bg-bg-main h-8 w-8 md:h-10 md:w-10"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("rounded-md h-8 w-8 md:h-10 md:w-10 hidden sm:flex", isListening ? "text-red-500 animate-pulse" : "text-text-muted")}
                onClick={startListening}
              >
                <Mic className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <Separator orientation="vertical" className="h-6 md:h-8 mx-0.5 md:mx-1" />
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Describe transaction..." 
                className="flex-1 border-none shadow-none focus-visible:ring-0 text-sm md:text-base placeholder:text-text-muted italic h-9 md:h-10 bg-transparent"
              />
              <Button 
                size="sm"
                className="bg-tally-green hover:bg-accent-green text-white font-bold uppercase tracking-wider px-3 md:px-6 h-8 md:h-9"
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage)}
              >
                {isLoading ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Send className="w-3 h-3 md:w-4 md:h-4" />}
                <span className="hidden sm:inline ml-2">Analyze</span>
              </Button>
            </div>
            <div className="flex justify-center items-center gap-4 md:gap-12 mt-2 md:mt-8 pt-4 border-t border-border/20 relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-tally-green/20 rounded-full" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-tally-green rotate-45" />
                <p className="text-[8px] md:text-[10px] text-text-muted font-black uppercase tracking-[0.2em]">Geometric Balance</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-accent-green rotate-45 shadow-[2px_2px_0_rgba(0,130,80,0.2)]" />
                <p className="text-[8px] md:text-[10px] text-text-muted font-black uppercase tracking-[0.2em]">Prime Mastery</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
