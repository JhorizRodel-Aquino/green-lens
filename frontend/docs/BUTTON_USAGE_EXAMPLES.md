import { Button } from '@/components/ui/Button';
import { 
  Camera, 
  Trash2, 
  MapPin, 
  Plus, 
  X, 
  ChevronRight,
  Home,
  User,
  Settings,
  Upload,
  Download
} from 'lucide-react';

// Icon-only buttons
<Button size="icon" icon={Camera} variant="primary" />
<Button size="icon" icon={X} variant="ghost" />
<Button size="iconLg" icon={Plus} variant="secondary" />

// Icons with text
<Button leftIcon={Camera} variant="primary">
  Take Photo
</Button>

<Button leftIcon={Trash2} variant="danger">
  Delete
</Button>

<Button rightIcon={ChevronRight} variant="primary">
  Next
</Button>

<Button leftIcon={MapPin} rightIcon={ChevronRight} variant="outline">
  Find Location
</Button>

// Different sizes with icons
<Button size="sm" leftIcon={Plus}>
  Add
</Button>

<Button size="lg" leftIcon={Upload}>
  Upload File
</Button>

<Button size="xl" leftIcon={Camera} variant="primary">
  Report Trash
</Button>

// Full width with icon
<Button fullWidth leftIcon={Download} variant="secondary">
  Download Report
</Button>

// Custom icon size
<Button leftIcon={User} iconSize={24} variant="ghost">
  Profile
</Button>

// Loading with icon
<Button leftIcon={Upload} isLoading>
  Uploading...
</Button>

// In your UserPage
<Button 
  onClick={() => setShowCamera(true)}
  leftIcon={Camera}
  size="lg"
  variant="primary"
  className="shadow-lg"
>
  Report Trash
</Button>