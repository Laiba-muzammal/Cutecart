import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-7xl">😿</div>
        
        <h1 className="text-4xl font-bold">Oops! Page Not Found</h1>
        
        <p className="text-muted-foreground text-lg">
          Sorry, we couldn't find the page you're looking for. Let's get you back to shopping cute stationery!
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button variant="outline" size="lg" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Go Back
            </Link>
          </Button>
          <Button size="lg" asChild>
            <Link to="/shop">
              <Home className="mr-2 h-5 w-5" />
              Back to Shop
            </Link>
          </Button>
        </div>

        <div className="pt-8 text-sm text-muted-foreground">
          <p>Error Code: 404</p>
        </div>
      </div>
    </div>
  );
}
