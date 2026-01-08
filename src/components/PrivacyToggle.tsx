import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePrivacy } from '@/contexts/PrivacyContext';

export function PrivacyToggle() {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePrivacyMode}
            className={isPrivacyMode ? 'text-primary' : 'text-muted-foreground'}
          >
            {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isPrivacyMode ? 'Desativar modo privacidade' : 'Ativar modo privacidade'} (Ctrl+P)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
