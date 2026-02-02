import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface LaunchOptionsProps {
  launchParameters: string;
  onChange: (parameters: string) => void;
}

export const LaunchOptions: React.FC<LaunchOptionsProps> = ({ launchParameters, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [parameters, setParameters] = useState(launchParameters);
  
  // Update parameters when the prop changes
  useEffect(() => {
    setParameters(launchParameters);
  }, [launchParameters]);
  
  const handleEdit = () => {
    setIsEditing(!isEditing);
    
    if (isEditing) {
      onChange(parameters);
    }
  };
  
  const getExampleParameters = () => {
    const examples = [
      "-skill 4 (Ultra-Violence difficulty)",
      "-warp E1M1 (start at Episode 1, Map 1)",
      "-warp 01 (Doom 2 format, start at Map 01)",
      "-file additional.wad (load another WAD file)",
      "-fast (faster enemies)",
      "-nomonsters (no monsters mode)"
    ];
    
    return examples;
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-mono">Launch Options</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleEdit}
          className="text-xs bg-[#0c1c2a] border-[#262626]"
        >
          {isEditing ? 'Save Parameters' : 'Add Additional Parameters'}
        </Button>
      </div>
      
      <div className="bg-[#0c1c2a] p-3 rounded">
        {isEditing ? (
          <>
            <Textarea 
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              className="bg-[#162b3d] border-[#262626] font-mono text-sm mb-2"
              placeholder="Enter additional launch parameters..."
              rows={2}
            />
            <div className="text-xs text-[#a0a0a0] mt-2">
              <p className="mb-1">Examples of common parameters:</p>
              <ul className="list-disc pl-5 space-y-1">
                {getExampleParameters().map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[#a0a0a0] mb-1">Current launch parameters:</p>
            <code className="text-sm text-[#e6e6e6] font-mono block overflow-x-auto p-2 bg-[#162b3d] rounded border border-[#262626]">
              {parameters || '<No custom parameters set>'}
            </code>
          </>
        )}
      </div>
    </div>
  );
};

export default LaunchOptions;
