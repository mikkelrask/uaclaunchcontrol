import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { moddbService } from '@/lib/moddbService';
import { ModDBSearchResult } from '@shared/schema';
import { Download, Star } from 'lucide-react';

export const ModDBPage: React.FC = () => {
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch popular and latest mods
  const { data: popularMods, isLoading: popularLoading } = useQuery({
    queryKey: ['/api/moddb/popular'],
    queryFn: moddbService.getPopularDoomMods,
  });
  
  const { data: latestMods, isLoading: latestLoading } = useQuery({
    queryKey: ['/api/moddb/latest'],
    queryFn: moddbService.getLatestDoomMods,
  });
  
  // Search query
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['/api/moddb/search', searchQuery],
    queryFn: () => moddbService.searchMods(searchQuery),
    enabled: searchQuery.length > 0,
  });
  
  const handleVersionSelect = (version: string) => {
    setActiveVersion(version === activeVersion ? null : version);
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  const handleInstallMod = (mod: ModDBSearchResult) => {
    alert(`Installation feature coming soon! Would install ${mod.name}`);
  };
  
  // Render a mod card
  const renderModCard = (mod: ModDBSearchResult) => (
    <Card key={mod.id} className="bg-[#1c1c1c] border-[#262626] overflow-hidden">
      <div className="h-40 relative">
        <img 
          src={mod.thumbnail || "https://via.placeholder.com/400x160.png?text=No+Image"} 
          alt={mod.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <h3 className="absolute bottom-2 left-3 text-white font-mono text-lg font-bold">{mod.name}</h3>
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-400 mr-1" />
            <span className="text-sm">{mod.rating}/10</span>
          </div>
          <div className="flex items-center">
            <Download className="h-4 w-4 mr-1" />
            <span className="text-sm">{mod.downloads.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-sm text-[#e6e6e6] line-clamp-2 mb-3">{mod.summary}</p>
        <Button 
          className="w-full bg-[#d41c1c] hover:bg-[#b21616] font-mono"
          onClick={() => handleInstallMod(mod)}
        >
          INSTALL
        </Button>
      </CardContent>
    </Card>
  );
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        activeVersion={activeVersion} 
        onVersionSelect={handleVersionSelect} 
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header onSearch={handleSearch} />
        
        <div className="flex-1 overflow-y-auto p-4">
          {searchQuery ? (
            <div>
              <h2 className="text-2xl font-mono font-bold mb-4">Search Results for "{searchQuery}"</h2>
              {searchLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array(4).fill(0).map((_, i) => (
                    <Card key={i} className="h-64 bg-[#1c1c1c] animate-pulse" />
                  ))}
                </div>
              ) : searchResults?.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[#e6e6e6]">No mods found matching your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {searchResults?.map(renderModCard)}
                </div>
              )}
            </div>
          ) : (
            <Tabs defaultValue="popular" className="w-full">
              <TabsList className="mb-4 bg-[#162b3d]">
                <TabsTrigger value="popular" className="data-[state=active]:bg-[#0c1c2a]">Popular Mods</TabsTrigger>
                <TabsTrigger value="latest" className="data-[state=active]:bg-[#0c1c2a]">Latest Releases</TabsTrigger>
              </TabsList>
              
              <TabsContent value="popular">
                <h2 className="text-2xl font-mono font-bold mb-4">Popular Doom Mods</h2>
                {popularLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array(8).fill(0).map((_, i) => (
                      <Card key={i} className="h-64 bg-[#1c1c1c] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {popularMods?.map(renderModCard)}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="latest">
                <h2 className="text-2xl font-mono font-bold mb-4">Latest Doom Mods</h2>
                {latestLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array(8).fill(0).map((_, i) => (
                      <Card key={i} className="h-64 bg-[#1c1c1c] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {latestMods?.map(renderModCard)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModDBPage;
