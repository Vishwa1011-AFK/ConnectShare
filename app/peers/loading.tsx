import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const PeerSectionSkeleton = () => (
  <div className="mb-8">
    <div className="flex items-center gap-2 mb-4">
      <Skeleton className="h-6 w-6 rounded-md" />
      <Skeleton className="h-7 w-32" />
    </div>
    <Card>
      <CardContent className="p-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 border-b last:border-b-0 border-border/50">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

export default function Loading() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Skeleton className="h-9 w-64 mb-2" /> 
            <Skeleton className="h-5 w-80" />
          </div>
          <Skeleton className="h-9 w-24" /> 
        </div>
      </div>
      <div className="mb-8">
         <Skeleton className="h-10 w-full" />
      </div>
      <PeerSectionSkeleton />
      <PeerSectionSkeleton />
    </div>
  );
}