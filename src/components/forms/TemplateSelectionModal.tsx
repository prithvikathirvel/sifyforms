import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Search } from 'lucide-react';
import api from '../../lib/api';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'static' | 'organization';
  createdAt?: string;
  createdBy?: string;
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  // now provide full template object so consumer can inspect type
  onSelectTemplate: (template: Template) => void;
}

export function TemplateSelectionContent({ onSelectTemplate }: { onSelectTemplate: (template: Template) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSelectTemplate = (template: Template) => {
    onSelectTemplate(template);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="p-4">
                  <div className="h-5 bg-muted rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates found matching your search.
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-brand-500 hover:shadow-sm transition-all group"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg truncate font-semibold">
                            {template.name}
                          </CardTitle>
                          {template.type === 'organization' ? (
                            <Badge variant="default" className="bg-brand-100 text-brand-800 hover:bg-brand-100 border-brand-200 whitespace-nowrap">
                              My Template
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs whitespace-nowrap border-border bg-muted text-muted-foreground">
                              System Template
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 text-sm">
                          {template.description}
                        </CardDescription>
                        {template.createdAt && (
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Created on {new Date(template.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      >
                        Use Template
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TemplateSelectionModal({ isOpen, onClose, onSelectTemplate }: TemplateSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built template or create from scratch
          </DialogDescription>
        </DialogHeader>
        <TemplateSelectionContent onSelectTemplate={(template) => {
          onSelectTemplate(template);
          onClose();
        }} />
      </DialogContent>
    </Dialog>
  );
}

export default TemplateSelectionModal;
