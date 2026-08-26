import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox as UICheckbox } from '../ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Trash2, Plus, Globe, Lock, Code, CheckCircle, Save } from 'lucide-react';
import type { FormField } from '../../types';

interface ExternalValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function ExternalValidationModal({ isOpen, onClose, field, onUpdate }: ExternalValidationModalProps) {
  const [activeTab, setActiveTab] = useState('connection');
  
  // Local state for edits
  const [config, setConfig] = useState(field.externalValidation || {
    enabled: false,
    url: '',
    method: 'POST' as const,
    auth: { type: 'none' as const },
    headers: [],
    params: [],
    responseCheck: { type: 'boolean' as const, path: 'isValid' }
  });

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      setConfig(field.externalValidation || {
        enabled: false,
        url: '',
        method: 'POST',
        auth: { type: 'none' },
        headers: [],
        params: [],
        responseCheck: { type: 'boolean', path: 'isValid' }
      });
      setActiveTab('connection');
    }
  }, [isOpen, field]);

  const handleSave = () => {
    onUpdate({ externalValidation: config });
    onClose();
  };

  const updateConfig = (updates: any) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const addParam = () => {
    const params = [...(config.params || [])];
    params.push({ key: '', value: '', type: 'static' });
    updateConfig({ params });
  };

  const updateParam = (index: number, key: string, value: string, type: 'static'|'field') => {
    const params = [...(config.params || [])];
    params[index] = { key, value, type };
    updateConfig({ params });
  };

  const removeParam = (index: number) => {
    const params = [...(config.params || [])];
    params.splice(index, 1);
    updateConfig({ params });
  };

  const addHeader = () => {
    const headers = [...(config.headers || [])];
    headers.push({ key: '', value: '' });
    updateConfig({ headers });
  };

  const updateHeader = (index: number, key: string, value: string) => {
    const headers = [...(config.headers || [])];
    headers[index] = { key, value };
    updateConfig({ headers });
  };

  const removeHeader = (index: number) => {
    const headers = [...(config.headers || [])];
    headers.splice(index, 1);
    updateConfig({ headers });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 pb-2 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              External Validation
            </DialogTitle>
            <DialogDescription>
              Validate field input against a third-party API during form submission.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-2 mt-4 bg-muted/50 p-3 rounded-md border">
            <UICheckbox
              id="ev-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => updateConfig({ enabled: !!checked })}
            />
            <Label htmlFor="ev-enabled" className="font-semibold cursor-pointer">
              Enable External Validation for {field.label}
            </Label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {config.enabled ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="connection" className="text-xs">
                  <Globe className="h-3 w-3 mr-2" /> Connection
                </TabsTrigger>
                <TabsTrigger value="auth" className="text-xs">
                  <Lock className="h-3 w-3 mr-2" /> Auth
                </TabsTrigger>
                <TabsTrigger value="headers" className="text-xs">
                  <Plus className="h-3 w-3 mr-2" /> Headers
                </TabsTrigger>
                <TabsTrigger value="params" className="text-xs">
                  <Code className="h-3 w-3 mr-2" /> Payload
                </TabsTrigger>
                <TabsTrigger value="response" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-2" /> Response
                </TabsTrigger>
              </TabsList>

              {/* CONNECTION TAB */}
              <TabsContent value="connection" className="space-y-4">
                <div className="space-y-2">
                  <Label>API Endpoint URL</Label>
                  <Input 
                    placeholder="https://api.example.com/validate" 
                    value={config.url}
                    onChange={e => updateConfig({ url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">The full URL of the validation service.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>HTTP Method</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={config.method || 'POST'}
                      onChange={e => updateConfig({ method: e.target.value })}
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Field Value Key</Label>
                    <Input 
                      placeholder="e.g. value, email, licenseKey" 
                      value={config.fieldValueKey || ''}
                      onChange={e => updateConfig({ fieldValueKey: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">JSON key for the field's data.</p>
                  </div>
                </div>
              </TabsContent>

              {/* AUTHENTICATION TAB */}
              <TabsContent value="auth" className="space-y-4">
                <div className="space-y-2 mb-4 mt-2">
                  <Label>Authentication Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={config.auth?.type || 'none'}
                    onChange={e => updateConfig({ auth: { ...config.auth, type: e.target.value } })}
                  >
                    <option value="none">No Authentication</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="custom">Custom Header</option>
                  </select>
                </div>

                {config.auth?.type === 'bearer' && (
                  <div className="space-y-2 bg-muted/20 p-4 rounded-md border">
                    <Label>Bearer Token</Label>
                    <Input 
                      type="password"
                      placeholder="Enter token (e.g. eyJhbGciOiJIUzI1Ni...)" 
                      value={config.auth.token || ''}
                      onChange={e => updateConfig({ auth: { ...config.auth, token: e.target.value } })}
                    />
                    <p className="text-xs text-muted-foreground">Will be sent as: Authorization: Bearer [token]</p>
                  </div>
                )}

                {config.auth?.type === 'basic' && (
                  <div className="space-y-4 bg-muted/20 p-4 rounded-md border">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input 
                          placeholder="API Username" 
                          value={config.auth.username || ''}
                          onChange={e => updateConfig({ auth: { ...config.auth, username: e.target.value } })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input 
                          type="password"
                          placeholder="API Password or Token" 
                          value={config.auth.password || ''}
                          onChange={e => updateConfig({ auth: { ...config.auth, password: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {config.auth?.type === 'custom' && (
                  <div className="space-y-4 bg-muted/20 p-4 rounded-md border">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Header Name</Label>
                        <Input 
                          placeholder="e.g. x-api-key" 
                          value={config.auth.customHeaderName || ''}
                          onChange={e => updateConfig({ auth: { ...config.auth, customHeaderName: e.target.value } })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Token / Value</Label>
                        <Input 
                          type="password"
                          placeholder="Enter API Key" 
                          value={config.auth.token || ''}
                          onChange={e => updateConfig({ auth: { ...config.auth, token: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* HEADERS TAB */}
              <TabsContent value="headers" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Custom HTTP Headers</Label>
                    <p className="text-xs text-muted-foreground">Add extra headers for the API request.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addHeader}>
                    <Plus className="h-4 w-4 mr-2" /> Add Header
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  {!config.headers?.length ? (
                    <div className="text-center p-6 border border-dashed rounded-md bg-muted/10 text-muted-foreground text-sm">
                      No custom headers defined.
                    </div>
                  ) : (
                    config.headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/20 p-2 rounded-md border">
                        <div className="flex-1 space-y-1">
                          <Input
                            placeholder="Header Key"
                            value={h.key}
                            className="h-8 text-xs"
                            onChange={e => updateHeader(i, e.target.value, h.value)}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Input
                            placeholder="Value"
                            value={h.value}
                            className="h-8 text-xs"
                            onChange={e => updateHeader(i, h.key, e.target.value)}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeHeader(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* PARAMETERS TAB */}
              <TabsContent value="params" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Extra Payload Parameters</Label>
                    <p className="text-xs text-muted-foreground">Add static values or other field values to the API request.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addParam}>
                    <Plus className="h-4 w-4 mr-2" /> Add Param
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  {!config.params?.length ? (
                    <div className="text-center p-6 border border-dashed rounded-md bg-muted/10 text-muted-foreground text-sm">
                      No extra parameters defined.
                    </div>
                  ) : (
                    config.params.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/20 p-2 rounded-md border">
                        <div className="flex-1 space-y-1">
                          <Input
                            placeholder="Key name"
                            value={p.key}
                            className="h-8 text-xs"
                            onChange={e => updateParam(i, e.target.value, p.value, p.type)}
                          />
                        </div>
                        <div className="w-32">
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background"
                            value={p.type}
                            onChange={e => updateParam(i, p.key, p.value, e.target.value as any)}
                          >
                            <option value="static">Static Value</option>
                            <option value="field">Form Field ID</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Input
                            placeholder={p.type === 'static' ? "Value" : "field_abc123"}
                            value={p.value}
                            className="h-8 text-xs"
                            onChange={e => updateParam(i, p.key, e.target.value, p.type)}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeParam(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* RESPONSE TAB */}
              <TabsContent value="response" className="space-y-4">
                <div className="bg-muted/20 p-4 border rounded-md space-y-4">
                  <h4 className="font-medium text-sm border-b pb-2">How should we check the response?</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Search Path (JSON Path)</Label>
                      <Input 
                        placeholder="e.g. data.isValid or status" 
                        value={config.responseCheck?.path || config.successPath || ''}
                        onChange={e => updateConfig({ responseCheck: { ...config.responseCheck, path: e.target.value } })}
                      />
                      <p className="text-[10px] text-muted-foreground">Leave empty to evaluate root response.</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Validation Logic</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={config.responseCheck?.type || 'boolean'}
                        onChange={e => updateConfig({ responseCheck: { ...config.responseCheck, type: e.target.value } })}
                      >
                        <option value="boolean">Is True (Boolean check)</option>
                        <option value="equals">Equals String</option>
                        <option value="notEquals">Not Equals String</option>
                        <option value="contains">Contains String</option>
                        <option value="notContains">Not Contains String</option>
                        <option value="regex">Matches Regex Pattern</option>
                        <option value="greaterThan">Greater Than (Number)</option>
                        <option value="lessThan">Less Than (Number)</option>
                        <option value="exists">Field Exists / Not Null</option>
                      </select>
                    </div>
                  </div>

                  {['equals', 'notEquals', 'contains', 'notContains', 'regex', 'greaterThan', 'lessThan'].includes(config.responseCheck?.type || '') && (
                    <div className="space-y-2 pt-2">
                      <Label>
                        {config.responseCheck?.type === 'regex' ? 'Regex Pattern' : 'Target Value to Match'}
                      </Label>
                      <Input 
                        placeholder={config.responseCheck?.type === 'regex' ? "e.g. ^[0-9]{5}$" : "e.g. success, active, OK"} 
                        value={config.responseCheck?.targetValue || ''}
                        onChange={e => updateConfig({ responseCheck: { ...config.responseCheck, targetValue: e.target.value } })}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="space-y-2">
                    <Label className="text-green-600">Success Message</Label>
                    <Input 
                      placeholder="e.g. Verified successfully!" 
                      value={config.successMsg || ''}
                      onChange={e => updateConfig({ successMsg: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-red-600">Failure Message</Label>
                    <Input 
                      placeholder="e.g. Invalid value provided." 
                      value={config.errorMsg || ''}
                      onChange={e => updateConfig({ errorMsg: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Globe className="h-8 w-8 opacity-50" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-1">External Validation is Disabled</h3>
                <p className="max-w-sm text-sm">
                  Enable this feature to send the field's value to a third-party API and validate the response before allowing form submission.
                </p>
              </div>
              <Button onClick={() => updateConfig({ enabled: true })}>
                Enable Now
              </Button>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/30">
          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button onClick={handleSave} disabled={!config.enabled && field.externalValidation?.enabled === false}>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
