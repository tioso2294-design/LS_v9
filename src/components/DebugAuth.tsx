import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, RefreshCw, Database, Key, Globe } from 'lucide-react';

const DebugAuth: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        console.log('=== DEBUG AUTH START ===');
        
        // Check environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        
        console.log('Supabase URL:', supabaseUrl);
        console.log('Supabase Key exists:', !!supabaseKey);
        console.log('Stripe Key exists:', !!stripeKey);
        
        setDebugInfo(prev => ({
          ...prev,
          supabaseUrl,
          supabaseKeyExists: !!supabaseKey,
          stripeKeyExists: !!stripeKey,
          envVars: {
            VITE_SUPABASE_URL: supabaseUrl || 'MISSING',
            VITE_SUPABASE_ANON_KEY: supabaseKey ? 'SET' : 'MISSING',
            VITE_STRIPE_PUBLISHABLE_KEY: stripeKey ? 'SET' : 'MISSING'
          }
        }));

        // Test basic Supabase connection
        console.log('Testing Supabase connection...');
        const connectionTest = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        
        console.log('Connection test status:', connectionTest.status);
        setDebugInfo(prev => ({
          ...prev,
          connectionTest: {
            status: connectionTest.status,
            ok: connectionTest.ok,
            statusText: connectionTest.statusText
          }
        }));
        // Test basic connection
        const { data, error } = await supabase.auth.getSession();
        console.log('Session data:', data);
        console.log('Session error:', error);
        
        setDebugInfo(prev => ({
          ...prev,
          sessionData: data,
          sessionError: error
        }));

        // Test database connection
        console.log('Testing database connection...');
        const { data: testData, error: testError } = await supabase
          .from('restaurants')
          .select('count')
          .limit(1);
          
        console.log('DB test data:', testData);
        console.log('DB test error:', testError);
        
        setDebugInfo(prev => ({
          ...prev,
          dbTestData: testData,
          dbTestError: testError
        }));

        console.log('=== DEBUG AUTH END ===');
      } catch (err) {
        console.error('Debug error:', err);
        setDebugInfo(prev => ({
          ...prev,
          debugError: err
        }));
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setDebugInfo({});
    window.location.reload();
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertCircle className="h-5 w-5 text-red-500" />
    );
  };
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Debug Dashboard</h1>
            <p className="text-gray-600">Diagnose connection and configuration issues</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Running diagnostics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Environment Variables */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Key className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Environment Variables</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">VITE_SUPABASE_URL</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(!!debugInfo.supabaseUrl)}
                    <span className="text-sm text-gray-600">
                      {debugInfo.supabaseUrl ? debugInfo.supabaseUrl.substring(0, 40) + '...' : 'Not Set'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">VITE_SUPABASE_ANON_KEY</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(debugInfo.supabaseKeyExists)}
                    <span className="text-sm text-gray-600">
                      {debugInfo.supabaseKeyExists ? 'Set' : 'Not Set'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">VITE_STRIPE_PUBLISHABLE_KEY</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(debugInfo.stripeKeyExists)}
                    <span className="text-sm text-gray-600">
                      {debugInfo.stripeKeyExists ? 'Set' : 'Not Set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Test */}
            {debugInfo.connectionTest && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="h-6 w-6 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Connection Test</h2>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Supabase API</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(debugInfo.connectionTest.ok)}
                    <span className="text-sm text-gray-600">
                      Status: {debugInfo.connectionTest.status} {debugInfo.connectionTest.statusText}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Session Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Database className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Authentication Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Session Data</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(!debugInfo.sessionError)}
                    <span className="text-sm text-gray-600">
                      {debugInfo.sessionError ? 'Error' : 'OK'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Database Test</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(!debugInfo.dbTestError)}
                    <span className="text-sm text-gray-600">
                      {debugInfo.dbTestError ? 'Error' : 'OK'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Details */}
            {(debugInfo.sessionError || debugInfo.dbTestError || debugInfo.debugError) && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                  <h2 className="text-xl font-semibold text-red-900">Error Details</h2>
                </div>
                <div className="space-y-4">
                  {debugInfo.sessionError && (
                    <div>
                      <h3 className="font-medium text-red-900 mb-2">Session Error:</h3>
                      <pre className="text-sm bg-red-100 p-3 rounded overflow-auto text-red-800">
                        {JSON.stringify(debugInfo.sessionError, null, 2)}
                      </pre>
                    </div>
                  )}
                  {debugInfo.dbTestError && (
                    <div>
                      <h3 className="font-medium text-red-900 mb-2">Database Error:</h3>
                      <pre className="text-sm bg-red-100 p-3 rounded overflow-auto text-red-800">
                        {JSON.stringify(debugInfo.dbTestError, null, 2)}
                      </pre>
                    </div>
                  )}
                  {debugInfo.debugError && (
                    <div>
                      <h3 className="font-medium text-red-900 mb-2">Debug Error:</h3>
                      <pre className="text-sm bg-red-100 p-3 rounded overflow-auto text-red-800">
                        {JSON.stringify(debugInfo.debugError, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Setup Instructions */}
            {(!debugInfo.supabaseUrl || !debugInfo.supabaseKeyExists) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <h2 className="text-xl font-semibold text-yellow-900">Setup Required</h2>
                </div>
                <div className="space-y-4 text-yellow-800">
                  <p className="font-medium">To fix this issue:</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Create a <code className="bg-yellow-100 px-2 py-1 rounded">.env</code> file in your project root</li>
                    <li>Add your Supabase project URL and anonymous key</li>
                    <li>Restart your development server</li>
                    <li>Click the "Connect to Supabase" button in the top right if available</li>
                  </ol>
                  <div className="bg-yellow-100 p-4 rounded-lg">
                    <p className="font-medium mb-2">Required .env format:</p>
                    <pre className="text-xs">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Raw Debug Data */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Raw Debug Data</h2>
              <pre className="text-sm overflow-auto bg-gray-50 p-4 rounded-lg max-h-96">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default DebugAuth;