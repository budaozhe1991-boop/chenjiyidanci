import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Trophy, 
  ChevronRight, 
  Image as ImageIcon,
  Type,
  Music,
  ArrowRightLeft,
  GraduationCap,
  LayoutGrid,
  History,
  Plus,
  Upload,
  Trash2,
  FileText,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORD_LIBRARY, type Word } from './data/words';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PracticeMode = 'PICTURE_TO_WORD' | 'AUDIO_TO_WORD' | 'COMPLETE_WORD' | 'MATCHING';

interface QuizState {
  currentWordIndex: number;
  score: number;
  totalAnswered: number;
  wrongWords: Word[];
  isFinished: boolean;
  showFeedback: boolean;
  lastAnswerCorrect: boolean | null;
  selectedAnswer: string | null;
}

const STORAGE_KEY = 'custom_words_v1';

export default function App() {
  // --- Settings State ---
  const [selectedBook, setSelectedBook] = useState<Word['book'] | 'CUSTOM'>('PEP_3A');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'basic' | 'advanced'>('all');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('PICTURE_TO_WORD');
  const [showSettings, setShowSettings] = useState(true);
  const [activeTab, setActiveTab] = useState<'official' | 'custom'>('official');

  // --- Custom Words State ---
  const [customWords, setCustomWords] = useState<Word[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [newWord, setNewWord] = useState({ word: '', translation: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Quiz State ---
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [state, setState] = useState<QuizState>({
    currentWordIndex: 0,
    score: 0,
    totalAnswered: 0,
    wrongWords: [],
    isFinished: false,
    showFeedback: false,
    lastAnswerCorrect: null,
    selectedAnswer: null,
  });

  const [imageError, setImageError] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customWords));
  }, [customWords]);

  const [showHint, setShowHint] = useState(false);

  // Reset hint and image error when word changes
  useEffect(() => {
    setShowHint(false);
    setImageError(false);
  }, [state.currentWordIndex]);

  // --- Derived Data ---
  const availableUnits = useMemo(() => {
    if (selectedBook === 'CUSTOM') return ['All'];
    const units = Array.from(new Set(WORD_LIBRARY.filter(w => w.book === selectedBook).map(w => w.unit)));
    return ['All', ...units];
  }, [selectedBook]);

  const currentWord = quizWords[state.currentWordIndex];

  // --- Audio ---
  const speak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- Custom Word Actions ---
  const addCustomWord = () => {
    if (!newWord.word || !newWord.translation) return;
    const word: Word = {
      id: `custom-${Date.now()}`,
      word: newWord.word.trim(),
      translation: newWord.translation.trim(),
      image: `https://img.icons8.com/fluency/400/${newWord.word.trim().toLowerCase()}.png`,
      example: `This is a ${newWord.word.trim()}.`,
      exampleTranslation: `这是一个${newWord.translation.trim()}。`,
      unit: 'Custom',
      book: 'PEP_3A', // Dummy
      difficulty: 'basic',
      partOfSpeech: 'noun',
    };
    setCustomWords(prev => [word, ...prev]);
    setNewWord({ word: '', translation: '' });
  };

  const deleteCustomWord = (id: string) => {
    setCustomWords(prev => prev.filter(w => w.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      const newWords: Word[] = [];
      
      lines.forEach(line => {
        const [word, translation] = line.split(/[,，\s]+/).map(s => s?.trim());
        if (word && translation) {
          newWords.push({
            id: `custom-${Date.now()}-${Math.random()}`,
            word,
            translation,
            image: `https://img.icons8.com/fluency/400/${word.toLowerCase()}.png`,
            example: `This is a ${word}.`,
            exampleTranslation: `这是一个${translation}。`,
            unit: 'Custom',
            book: 'PEP_3A',
            difficulty: 'basic',
            partOfSpeech: 'noun',
          });
        }
      });

      if (newWords.length > 0) {
        setCustomWords(prev => [...newWords, ...prev]);
        alert(`成功导入 ${newWords.length} 个单词！`);
      } else {
        alert('未识别到有效单词，请确保格式为：单词,翻译');
      }
    };
    reader.readAsText(file);
  };

  // --- Quiz Logic ---
  const startQuiz = () => {
    let pool: Word[] = [];
    if (selectedBook === 'CUSTOM') {
      pool = customWords;
    } else {
      pool = WORD_LIBRARY.filter(w => w.book === selectedBook);
      if (selectedUnit !== 'All') {
        pool = pool.filter(w => w.unit === selectedUnit);
      }
      if (selectedDifficulty !== 'all') {
        pool = pool.filter(w => w.difficulty === selectedDifficulty);
      }
    }

    if (pool.length === 0) {
      alert('所选范围内没有单词，请先添加单词！');
      return;
    }

    // Shuffle and take up to 10
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    
    setQuizWords(shuffled);
    setState({
      currentWordIndex: 0,
      score: 0,
      totalAnswered: 0,
      wrongWords: [],
      isFinished: false,
      showFeedback: false,
      lastAnswerCorrect: null,
      selectedAnswer: null,
    });
    setShowSettings(false);
  };

  const handleAnswer = (answer: string) => {
    if (state.showFeedback) return;

    const isCorrect = answer === currentWord.word;
    
    setState(prev => ({
      ...prev,
      selectedAnswer: answer,
      lastAnswerCorrect: isCorrect,
      showFeedback: true,
      score: isCorrect ? prev.score + 1 : prev.score,
      totalAnswered: prev.totalAnswered + 1,
      wrongWords: isCorrect ? prev.wrongWords : [...prev.wrongWords, currentWord],
    }));

    if (isCorrect) {
      speak(currentWord.word);
    }
  };

  const nextQuestion = () => {
    if (state.currentWordIndex + 1 < quizWords.length) {
      setState(prev => ({
        ...prev,
        currentWordIndex: prev.currentWordIndex + 1,
        showFeedback: false,
        lastAnswerCorrect: null,
        selectedAnswer: null,
      }));
    } else {
      setState(prev => ({ ...prev, isFinished: true }));
      if (state.score / quizWords.length >= 0.8) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  };

  const restart = () => {
    setShowSettings(true);
  };

  // --- Options Generation ---
  const options = useMemo(() => {
    if (!currentWord) return [];
    
    const distractors = currentWord.commonErrors || [];
    const allAvailableWords = [...WORD_LIBRARY, ...customWords];
    let pool = distractors.length >= 3 
      ? distractors.slice(0, 3) 
      : [...distractors, ...allAvailableWords.filter(w => w.id !== currentWord.id).map(w => w.word).sort(() => Math.random() - 0.5).slice(0, 3 - distractors.length)];
    
    return [currentWord.word, ...pool].sort(() => Math.random() - 0.5);
  }, [currentWord, customWords]);

  // --- Render Helpers ---
  const renderModeIcon = (mode: PracticeMode) => {
    switch (mode) {
      case 'PICTURE_TO_WORD': return <ImageIcon className="w-5 h-5" />;
      case 'AUDIO_TO_WORD': return <Music className="w-5 h-5" />;
      case 'COMPLETE_WORD': return <Type className="w-5 h-5" />;
      case 'MATCHING': return <ArrowRightLeft className="w-5 h-5" />;
    }
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-[#FDFCF0] text-[#2D3436] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFD93D] p-3 rounded-2xl shadow-lg">
              <GraduationCap className="w-8 h-8 text-[#2D3436]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">小学英语单词趣味练</h1>
              <p className="text-sm text-gray-500 font-medium">三年级互动学习平台</p>
            </div>
          </div>
          
          {!showSettings && !state.isFinished && (
            <div className="flex items-center gap-4">
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                <span className="text-sm font-bold text-gray-400 mr-2">进度</span>
                <span className="text-lg font-black text-[#FF8B13]">{state.currentWordIndex + 1}</span>
                <span className="text-sm text-gray-400"> / {quizWords.length}</span>
              </div>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Settings className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {showSettings ? (
            /* Settings Panel */
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[2rem] p-8 shadow-xl border-4 border-[#FFD93D]"
            >
              {/* Tabs */}
              <div className="flex gap-4 mb-8">
                <button
                  onClick={() => setActiveTab('official')}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2",
                    activeTab === 'official' ? "bg-[#FFD93D] text-[#2D3436]" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  )}
                >
                  <BookOpen className="w-5 h-5" /> 官方词库
                </button>
                <button
                  onClick={() => setActiveTab('custom')}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2",
                    activeTab === 'custom' ? "bg-[#FFD93D] text-[#2D3436]" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  )}
                >
                  <User className="w-5 h-5" /> 我的词库
                </button>
              </div>

              {activeTab === 'official' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: Book & Unit */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">选择教材</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'PEP_3A', label: '人教版 3上' },
                          { id: 'PEP_3B', label: '人教版 3下' },
                          { id: 'WY_3A', label: '外研版 3上' },
                          { id: 'WY_3B', label: '外研版 3下' },
                        ].map(book => (
                          <button
                            key={book.id}
                            onClick={() => setSelectedBook(book.id as any)}
                            className={cn(
                              "py-4 px-4 rounded-2xl font-bold transition-all border-2 text-center",
                              selectedBook === book.id 
                                ? "bg-[#FFD93D] border-[#FFD93D] shadow-md scale-[1.02]" 
                                : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            {book.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">选择单元</label>
                      <div className="flex flex-wrap gap-2">
                        {availableUnits.map(unit => (
                          <button
                            key={unit}
                            onClick={() => setSelectedUnit(unit)}
                            className={cn(
                              "px-4 py-2 rounded-full font-bold transition-all border-2",
                              selectedUnit === unit 
                                ? "bg-[#6C5CE7] border-[#6C5CE7] text-white shadow-md" 
                                : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            {unit === 'All' ? '全部单元' : unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Mode & Difficulty */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">练习模式</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'PICTURE_TO_WORD', label: '看图选词', icon: <ImageIcon /> },
                          { id: 'AUDIO_TO_WORD', label: '听音选词', icon: <Music /> },
                          { id: 'COMPLETE_WORD', label: '补全单词', icon: <Type /> },
                          { id: 'MATCHING', label: '中英配对', icon: <ArrowRightLeft /> },
                        ].map(mode => (
                          <button
                            key={mode.id}
                            onClick={() => setPracticeMode(mode.id as PracticeMode)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-2xl font-bold transition-all border-2",
                              practiceMode === mode.id 
                                ? "bg-[#00CEC9] border-[#00CEC9] text-white shadow-md scale-[1.02]" 
                                : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            {mode.icon}
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">难度筛选</label>
                      <div className="flex gap-3">
                        {[
                          { id: 'all', label: '全部' },
                          { id: 'basic', label: '基础' },
                          { id: 'advanced', label: '提高' },
                        ].map(diff => (
                          <button
                            key={diff.id}
                            onClick={() => setSelectedDifficulty(diff.id as any)}
                            className={cn(
                              "flex-1 py-3 rounded-2xl font-bold transition-all border-2",
                              selectedDifficulty === diff.id 
                                ? "bg-[#FF7675] border-[#FF7675] text-white shadow-md" 
                                : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            {diff.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Custom Words Management */
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Add Word Form */}
                    <div className="space-y-4">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Plus className="w-5 h-5 text-[#FFD93D]" /> 手动添加
                      </h3>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="输入英文单词 (如: apple)"
                          value={newWord.word}
                          onChange={e => setNewWord(prev => ({ ...prev, word: e.target.value }))}
                          className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#FFD93D] outline-none font-bold"
                        />
                        <input
                          type="text"
                          placeholder="输入中文翻译 (如: 苹果)"
                          value={newWord.translation}
                          onChange={e => setNewWord(prev => ({ ...prev, translation: e.target.value }))}
                          className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-[#FFD93D] outline-none font-bold"
                        />
                        <button
                          onClick={addCustomWord}
                          className="w-full py-4 bg-[#FFD93D] rounded-2xl font-black text-lg shadow-md hover:scale-[1.02] transition-transform"
                        >
                          确认添加
                        </button>
                      </div>
                    </div>

                    {/* Upload Section */}
                    <div className="space-y-4">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Upload className="w-5 h-5 text-[#00CEC9]" /> 批量导入
                      </h3>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-48 border-4 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <FileText className="w-12 h-12 text-gray-300" />
                        <p className="text-gray-400 font-bold">点击上传单词文档 (.txt)</p>
                        <p className="text-xs text-gray-300">格式：单词,翻译 (每行一个)</p>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          accept=".txt"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Word List */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg">已添加单词 ({customWords.length})</h3>
                      <button 
                        onClick={() => {
                          setSelectedBook('CUSTOM');
                          startQuiz();
                        }}
                        className="px-6 py-2 bg-[#6C5CE7] text-white rounded-full font-bold shadow-md hover:scale-105 transition-transform"
                      >
                        开始练习我的词库
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                      {customWords.map(word => (
                        <div key={word.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group">
                          <div className="flex items-center gap-4">
                            <span className="font-black text-lg">{word.word}</span>
                            <span className="text-gray-400 font-medium">{word.translation}</span>
                          </div>
                          <button 
                            onClick={() => deleteCustomWord(word.id)}
                            className="p-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      {customWords.length === 0 && (
                        <div className="text-center py-8 text-gray-300 font-bold italic">
                          还没有添加任何单词哦~
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'official' && (
                <div className="mt-10">
                  <button
                    onClick={startQuiz}
                    className="w-full py-6 bg-[#FFD93D] hover:bg-[#FFC300] text-[#2D3436] font-black text-2xl rounded-3xl shadow-[0_8px_0_0_#D4A017] active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-3"
                  >
                    开始练习 <ChevronRight className="w-8 h-8" />
                  </button>
                </div>
              )}
            </motion.div>
          ) : state.isFinished ? (
            /* Results Screen */
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2rem] p-12 shadow-xl border-4 border-[#FFD93D] text-center"
            >
              <div className="inline-block p-6 bg-[#FFF9E6] rounded-full mb-6">
                <Trophy className="w-20 h-20 text-[#FFD93D]" />
              </div>
              <h2 className="text-4xl font-black mb-2">太棒了！</h2>
              <p className="text-gray-500 text-lg mb-8">你完成了本次练习</p>

              <div className="grid grid-cols-3 gap-4 mb-10">
                <div className="bg-gray-50 p-6 rounded-3xl">
                  <div className="text-sm font-bold text-gray-400 mb-1">正确率</div>
                  <div className="text-3xl font-black text-[#00CEC9]">{Math.round((state.score / quizWords.length) * 100)}%</div>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl">
                  <div className="text-sm font-bold text-gray-400 mb-1">答对</div>
                  <div className="text-3xl font-black text-[#6C5CE7]">{state.score} 题</div>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl">
                  <div className="text-sm font-bold text-gray-400 mb-1">总题数</div>
                  <div className="text-3xl font-black text-[#FF8B13]">{quizWords.length} 题</div>
                </div>
              </div>

              {state.wrongWords.length > 0 && (
                <div className="mb-10 text-left">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-red-400" />
                    需要复习的单词：
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(state.wrongWords.map(w => w.word))).map(word => (
                      <span key={word} className="px-4 py-2 bg-red-50 text-red-500 rounded-full font-bold border border-red-100">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={restart}
                  className="flex-1 py-5 bg-[#FFD93D] hover:bg-[#FFC300] text-[#2D3436] font-black text-xl rounded-2xl shadow-[0_6px_0_0_#D4A017] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-6 h-6" /> 再练一次
                </button>
              </div>
            </motion.div>
          ) : (
            /* Quiz Screen */
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Question Card */}
              <div className="bg-white rounded-[2rem] p-8 shadow-xl border-4 border-[#FFD93D] relative overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  {/* Visual/Audio Area */}
                  <div className="w-full md:w-1/2 aspect-video bg-gray-50 rounded-2xl flex items-center justify-center relative group">
                    {practiceMode === 'AUDIO_TO_WORD' ? (
                      <button 
                        onClick={() => speak(currentWord.word)}
                        className="w-24 h-24 bg-[#6C5CE7] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <Volume2 className="w-12 h-12" />
                      </button>
                    ) : (
                      imageError ? (
                        <div className="text-4xl font-black text-gray-300 uppercase tracking-widest">
                          {currentWord.word}
                        </div>
                      ) : (
                        <img 
                          src={currentWord.image} 
                          alt="Word visual" 
                          className="w-full h-full object-contain p-4 rounded-2xl"
                          referrerPolicy="no-referrer"
                          onError={() => setImageError(true)}
                        />
                      )
                    )}
                    
                    {practiceMode === 'PICTURE_TO_WORD' && (
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <button 
                          onClick={() => setShowHint(!showHint)}
                          className="bg-white/90 p-2 rounded-full shadow-md hover:bg-white transition-colors text-xs font-bold text-gray-400"
                        >
                          {showHint ? currentWord.word : '提示'}
                        </button>
                        <button 
                          onClick={() => speak(currentWord.word)}
                          className="bg-white/90 p-2 rounded-full shadow-md hover:bg-white transition-colors"
                        >
                          <Volume2 className="w-5 h-5 text-[#6C5CE7]" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="w-full md:w-1/2 text-center md:text-left space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFF9E6] text-[#D4A017] rounded-full text-xs font-bold uppercase tracking-wider">
                      {renderModeIcon(practiceMode)}
                      {practiceMode === 'PICTURE_TO_WORD' && '看图选词'}
                      {practiceMode === 'AUDIO_TO_WORD' && '听音选词'}
                      {practiceMode === 'COMPLETE_WORD' && '补全单词'}
                      {practiceMode === 'MATCHING' && '中英配对'}
                    </div>
                    
                    <h2 className="text-5xl font-black tracking-tight text-[#2D3436]">
                      {practiceMode === 'COMPLETE_WORD' ? (
                        currentWord.word.split('').map((char, i) => (
                          <span key={i} className={cn(
                            "inline-block min-w-[1ch] border-b-4 mx-0.5",
                            i % 2 === 1 ? "border-[#FFD93D] text-transparent" : "border-transparent"
                          )}>
                            {i % 2 === 1 ? '_' : char}
                          </span>
                        ))
                      ) : practiceMode === 'MATCHING' ? (
                        currentWord.translation
                      ) : (
                        <span className="opacity-0">? ? ?</span>
                      )}
                    </h2>
                    
                    <p className="text-xl text-gray-400 font-medium">
                      {practiceMode === 'PICTURE_TO_WORD' || practiceMode === 'AUDIO_TO_WORD' ? '这是什么？' : '请选择正确答案'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-2 gap-4">
                {options.map((option, idx) => {
                  const isSelected = state.selectedAnswer === option;
                  const isCorrect = option === currentWord.word;
                  
                  return (
                    <button
                      key={idx}
                      disabled={state.showFeedback}
                      onClick={() => handleAnswer(option)}
                      className={cn(
                        "py-6 px-4 rounded-3xl font-black text-2xl transition-all border-4 shadow-[0_8px_0_0_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-2",
                        !state.showFeedback && "bg-white border-white hover:border-[#FFD93D] hover:scale-[1.02]",
                        state.showFeedback && isCorrect && "bg-[#00CEC9] border-[#00CEC9] text-white shadow-[0_8px_0_0_#00A8A8]",
                        state.showFeedback && isSelected && !isCorrect && "bg-[#FF7675] border-[#FF7675] text-white shadow-[0_8px_0_0_#D63031]",
                        state.showFeedback && !isCorrect && !isSelected && "bg-white border-gray-100 opacity-50"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Overlay */}
              <AnimatePresence>
                {state.showFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2rem] p-8 shadow-2xl border-4 border-gray-100 relative"
                  >
                    <div className="flex items-start gap-6">
                      <div className={cn(
                        "p-4 rounded-2xl",
                        state.lastAnswerCorrect ? "bg-[#E0FFF4]" : "bg-[#FFF0F0]"
                      )}>
                        {state.lastAnswerCorrect ? (
                          <CheckCircle2 className="w-12 h-12 text-[#00CEC9]" />
                        ) : (
                          <XCircle className="w-12 h-12 text-[#FF7675]" />
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-3xl font-black">{currentWord.word}</h3>
                          <button 
                            onClick={() => speak(currentWord.word)}
                            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                          <span className="text-xl text-gray-500 font-bold">/ {currentWord.translation} /</span>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border-l-4 border-[#FFD93D]">
                          <p className="text-lg font-medium italic text-gray-600">"{currentWord.example}"</p>
                          <p className="text-sm text-gray-400 mt-1">{currentWord.exampleTranslation}</p>
                        </div>

                        {!state.lastAnswerCorrect && currentWord.commonErrors && (
                          <div className="text-sm">
                            <span className="font-bold text-red-400">注意区分：</span>
                            <span className="text-gray-500">{currentWord.commonErrors.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={nextQuestion}
                        className="bg-[#2D3436] text-white px-8 py-4 rounded-2xl font-bold hover:bg-black transition-colors flex items-center gap-2"
                      >
                        {state.currentWordIndex + 1 === quizWords.length ? '查看结果' : '下一题'}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <footer className="mt-12 text-center text-gray-400 text-sm font-medium">
          <p>© 2026 小学英语趣味学习平台 · 快乐单词，轻松记忆</p>
        </footer>
      </div>
    </div>
  );
}
