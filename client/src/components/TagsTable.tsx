import { Code, Search, MessageSquare, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MetaTag } from "@shared/schema";

type TagsTableProps = {
  tags: MetaTag[];
};

export default function TagsTable({ tags }: TagsTableProps) {
  // Function to get the tag icon
  const getTagIcon = (tagType: string) => {
    switch (tagType) {
      case "SEO":
        return <Search className="h-5 w-5 text-primary" />;
      case "Social":
        return <MessageSquare className="h-5 w-5 text-indigo-500" />;
      case "Technical":
        return <Code className="h-5 w-5 text-slate-500" />;
      default:
        return <Code className="h-5 w-5 text-primary" />;
    }
  };

  // Function to get the tag icon background
  const getTagIconBg = (tagType: string) => {
    switch (tagType) {
      case "SEO":
        return "bg-blue-100";
      case "Social":
        return "bg-indigo-100";
      case "Technical":
        return "bg-slate-100";
      default:
        return "bg-blue-100";
    }
  };

  // Function to get tag status badge
  const getStatusBadge = (isPresent: boolean) => {
    if (isPresent) {
      return <Badge variant="secondary" className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-success">Good</Badge>;
    }
    return <Badge variant="caution" className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-secondary">Missing</Badge>;
  };

  // Function to get tag attributes as a string
  const getTagAttributes = (tag: MetaTag) => {
    const attributes = [];
    
    if (tag.name) attributes.push(`name="${tag.name}"`);
    if (tag.property) attributes.push(`property="${tag.property}"`);
    if (tag.httpEquiv) attributes.push(`http-equiv="${tag.httpEquiv}"`);
    if (tag.charset) attributes.push(`charset="${tag.charset}"`);
    if (tag.rel) attributes.push(`rel="${tag.rel}"`);
    
    return attributes.length > 0 ? attributes.join(", ") : "-";
  };

  // Function to get tag name for display
  const getTagName = (tag: MetaTag) => {
    if (tag.name === "title") return "title";
    if (tag.name) return tag.name;
    if (tag.property) return tag.property;
    if (tag.rel) return tag.rel;
    if (tag.httpEquiv) return tag.httpEquiv;
    if (tag.charset) return "charset";
    return "unknown";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tag Type</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Attributes</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Content</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-slate-200">
          {tags.map((tag, index) => (
            <TableRow key={index}>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md ${getTagIconBg(tag.tagType)}`}>
                    {!tag.isPresent ? <AlertTriangle className="h-5 w-5 text-secondary" /> : getTagIcon(tag.tagType)}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-slate-900">{getTagName(tag)}</div>
                    <div className="text-xs text-slate-500">{tag.tagType}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <div className="text-sm text-slate-900">{getTagAttributes(tag)}</div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <div 
                  className="text-sm text-slate-500 max-w-md truncate"
                  title={tag.content || ""}
                >
                  {tag.content || "-"}
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(tag.isPresent)}
              </TableCell>
            </TableRow>
          ))}
          {tags.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8">
                <p className="text-slate-500">No tags found for this category</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
