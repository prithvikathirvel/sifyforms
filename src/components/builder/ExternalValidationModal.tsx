import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
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

function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test(String(url).trim());
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
        <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">External Validation</h2>
              <p className="text-xs text-muted-foreground">Check "{field.label}" against a third-party API.</p>
            </div>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <span className={`text-xs font-medium ${config.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
              {config.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <UICheckbox
              id="ev-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => updateConfig({ enabled: !!checked })}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {config.enabled ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-5 grid w-full grid-cols-5 rounded-lg bg-muted/60 p-1">
                <TabsTrigger value="connection" className="gap-1.5 text-[11px]">
                  <Globe className="h-3.5 w-3.5" /> Connection
                </TabsTrigger>
                <TabsTrigger value="auth" className="gap-1.5 text-[11px]">
                  <Lock className="h-3.5 w-3.5" /> Auth
                </TabsTrigger>
                <TabsTrigger value="headers" className="gap-1.5 text-[11px]">
                  <Plus className="h-3.5 w-3.5" /> Headers
                </TabsTrigger>
                <TabsTrigger value="params" className="gap-1.5 text-[11px]">
                  <Code className="h-3.5 w-3.5" /> Payload
                </TabsTrigger>
                <TabsTrigger value="response" className="gap-1.5 text-[11px]">
                  <CheckCircle className="h-3.5 w-3.5" /> Response
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
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">External validation is off</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Turn it on to send this field's value to a third-party API and check the response before the form can be submitted.
              </p>
              <Button size="sm" className="mt-4" onClick={() => updateConfig({ enabled: true })}>
                Enable validation
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-[11px] text-muted-foreground">
            {config.enabled && !isValidUrl(config.url)
              ? 'Enter a valid endpoint URL to enable.'
              : 'Credentials are stored securely and never shown to respondents.'}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} type="button" className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={config.enabled && !isValidUrl(config.url)} className="h-8 gap-1.5 text-xs">
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
