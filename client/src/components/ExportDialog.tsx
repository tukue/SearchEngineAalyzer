import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Download, FileText, Globe, Loader2 } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: number;
  url: string;
}

interface ExportOptions {
  format: "pdf" | "html";
  includeRecommendations: boolean;
  includeRawData: boolean;
  customTitle?: string;
}

export default function ExportDialog({ open, onOpenChange, runId, url }: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    format: "pdf",
    includeRecommendations: true,
    includeRawData: false,
  });
  const { toast } = useToast();

  const { mutate: exportReport, isPending } = useMutation({
    mutationFn: async (exportOptions: ExportOptions) => {
      const res = await apiRequest("POST", `/api/audits/${runId}/export`, exportOptions);
      return res.json();
    },
    onSuccess: (data: { downloadUrl: string; shareUrl?: string }) => {
      // Trigger download
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = `audit-report-${runId}.${options.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Complete",
        description: `Report exported successfully as ${options.format.toUpperCase()}`,
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message,
      });
    },
  });

  const handleExport = () => {
    exportReport(options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Audit Report
          </DialogTitle>
          <DialogDescription>
            Export your audit results for {new URL(url).hostname}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup
              value={options.format}
              onValueChange={(value: "pdf" | "html") =>
                setOptions({ ...options, format: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  PDF Report
                  <span className="text-xs text-muted-foreground">
                    (Professional, printable)
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="html" id="html" />
                <Label htmlFor="html" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4" />
                  HTML Report
                  <span className="text-xs text-muted-foreground">
                    (Interactive, shareable)
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Content Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include in Report</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recommendations"
                  checked={options.includeRecommendations}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeRecommendations: !!checked })
                  }
                />
                <Label htmlFor="recommendations" className="cursor-pointer">
                  Recommendations & Action Items
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rawdata"
                  checked={options.includeRawData}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeRawData: !!checked })
                  }
                />
                <Label htmlFor="rawdata" className="cursor-pointer">
                  Raw Meta Tag Data
                </Label>
              </div>
            </div>
          </div>

          {/* Custom Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Custom Report Title (Optional)
            </Label>
            <Input
              id="title"
              placeholder={`Meta Tag Audit - ${new URL(url).hostname}`}
              value={options.customTitle || ""}
              onChange={(e) =>
                setOptions({ ...options, customTitle: e.target.value })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {options.format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}