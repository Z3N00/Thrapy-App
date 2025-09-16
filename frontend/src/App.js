import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(userData));
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || "Login failed" };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const { access_token, user: newUser } = response.data;
      
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(newUser));
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      setUser(newUser);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || "Registration failed" };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Components
const Header = () => {
  const { user, logout } = useAuth();
  
  return (
    <header className="bg-gray-900 border-b border-gray-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-gray-100">
          Thrapy
        </Link>
        
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">Welcome, {user.full_name}</span>
            <button
              onClick={logout}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAITherapy = () => {
    if (!user) {
      navigate("/login");
    } else {
      navigate("/ai-therapy");
    }
  };

  const handleLicensedTherapist = () => {
    if (!user) {
      navigate("/login");
    } else {
      navigate("/therapists");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-gray-100 mb-6">
            Welcome to <span className="text-blue-400">Thrapy</span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 leading-relaxed">
            Your mental health journey starts here. Choose between AI-powered therapy sessions 
            or connect with licensed therapists for personalized care.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* AI Therapy Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 shadow-xl">
              <div className="mb-6">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-100 mb-3">AI Therapy</h3>
                <p className="text-gray-400 mb-6">
                  Get instant support with our compassionate AI therapist. Available 24/7 for immediate guidance and emotional support.
                </p>
                <div className="text-blue-400 font-semibold text-lg mb-6">$5 per hour</div>
              </div>
              <button
                onClick={handleAITherapy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 transform hover:scale-105"
              >
                Start AI Session
              </button>
            </div>

            {/* Licensed Therapist Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 shadow-xl">
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-100 mb-3">Licensed Therapist</h3>
                <p className="text-gray-400 mb-6">
                  Connect with certified mental health professionals for personalized therapy sessions tailored to your needs.
                </p>
                <div className="text-green-400 font-semibold text-lg mb-6">Therapist sets rate</div>
              </div>
              <button
                onClick={handleLicensedTherapist}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 transform hover:scale-105"
              >
                Find Therapist
              </button>
            </div>
          </div>

          {user && user.role === "therapist" && (
            <div className="mt-12 p-6 bg-gray-800 border border-gray-700 rounded-xl">
              <h3 className="text-xl font-semibold text-gray-100 mb-4">Therapist Dashboard</h3>
              <div className="flex justify-center space-x-4">
                <Link
                  to="/therapist/register"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Complete Profile
                </Link>
                <Link
                  to="/dashboard"
                  className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  View Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(email, password);
    
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-100 text-center mb-8">Login to Thrapy</h2>
        
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        
        <p className="text-center text-gray-400 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-blue-400 hover:text-blue-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

const Register = () => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "client"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await register(formData);
    
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-100 text-center mb-8">Join Thrapy</h2>
        
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">I am a:</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="client">Client seeking therapy</option>
              <option value="therapist">Licensed therapist</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        
        <p className="text-center text-gray-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

const AITherapy = () => {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionCreating, setSessionCreating] = useState(false);

  const createSession = async () => {
    setSessionCreating(true);
    try {
      const response = await axios.post(`${API}/sessions/create`, {
        session_type: "ai",
        duration_minutes: 60,
        cost: 5.0
      });
      setSessionId(response.data.id);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
    setSessionCreating(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionId) return;
    
    const userMessage = newMessage;
    setNewMessage("");
    setMessages(prev => [...prev, { type: "user", text: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post(`${API}/ai-chat`, {
        session_id: sessionId,
        message: userMessage
      });
      
      setMessages(prev => [...prev, { type: "ai", text: response.data.response }]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => [...prev, { type: "error", text: "Sorry, I couldn't respond right now." }]);
    }
    
    setLoading(false);
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold text-gray-100 mb-6">Start AI Therapy Session</h2>
          <p className="text-gray-300 mb-8">
            Ready to begin your therapy session? This will cost $5 for a 1-hour session.
          </p>
          <button
            onClick={createSession}
            disabled={sessionCreating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {sessionCreating ? "Creating session..." : "Start Session ($5)"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl h-[600px] flex flex-col">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-gray-100">AI Therapy Session</h2>
            <p className="text-gray-400">Session ID: {sessionId}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <p>Hello! I'm your AI therapist. How are you feeling today?</p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : message.type === "error"
                      ? "bg-red-900 text-red-100"
                      : "bg-gray-700 text-gray-100"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-100 px-4 py-3 rounded-2xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-gray-700">
            <div className="flex space-x-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TherapistList = () => {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTherapists = async () => {
      try {
        const response = await axios.get(`${API}/therapists`);
        setTherapists(response.data);
      } catch (error) {
        console.error("Failed to fetch therapists:", error);
      }
      setLoading(false);
    };

    fetchTherapists();
  }, []);

  const bookSession = async (therapistId, hourlyRate) => {
    try {
      await axios.post(`${API}/sessions/create`, {
        session_type: "therapist",
        therapist_id: therapistId,
        duration_minutes: 60,
        cost: hourlyRate
      });
      alert("Session booked successfully!");
    } catch (error) {
      console.error("Failed to book session:", error);
      alert("Failed to book session. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-100">Loading therapists...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-100 text-center mb-12">Licensed Therapists</h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {therapists.map((therapist) => (
            <div key={therapist.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <div className="text-center mb-4">
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">
                    {therapist.user_id ? therapist.user_id.charAt(0).toUpperCase() : "T"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-100 mb-2">Licensed Therapist</h3>
                <p className="text-green-400 font-semibold">${therapist.hourly_rate}/hour</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div>
                  <span className="text-gray-400 text-sm">Specialization:</span>
                  <p className="text-gray-100">{therapist.specialization}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Experience:</span>
                  <p className="text-gray-100">{therapist.years_experience} years</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Bio:</span>
                  <p className="text-gray-100 text-sm">{therapist.bio}</p>
                </div>
              </div>
              
              <button
                onClick={() => bookSession(therapist.id, therapist.hourly_rate)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Book Session (${therapist.hourly_rate})
              </button>
            </div>
          ))}
        </div>
        
        {therapists.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p>No therapists available at the moment. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-100">Loading...</div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/ai-therapy"
              element={
                <ProtectedRoute>
                  <AITherapy />
                </ProtectedRoute>
              }
            />
            <Route
              path="/therapists"
              element={
                <ProtectedRoute>
                  <TherapistList />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;