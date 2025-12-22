import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Link2, X, Loader2 } from "lucide-react";

const formSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .refine(
      (value) => {
        try {
          const urlWithProtocol = value.startsWith("http://") || value.startsWith("https://")
            ? value
            : `https://${value}`;
          new URL(urlWithProtocol);
          return true;
        } catch (e) {
          return false;
        }
      },
      {
        message: "Please enter a valid URL (e.g., example.com or https://example.com)",
      },
    ),
});

const formResolver: Resolver<z.infer<typeof formSchema>> = async (values) => {
  const result = formSchema.safeParse(values);

  if (result.success) {
    return {
      values: result.data,
      errors: {} as FieldErrors<z.infer<typeof formSchema>>,
    };
  }

  const issue = result.error.issues[0];

  const errors: FieldErrors<z.infer<typeof formSchema>> = {
    url: {
      type: issue?.code ?? "validation",
      message: issue?.message ?? "Invalid URL",
    },
  };

  return {
    values: { url: values.url } as z.infer<typeof formSchema>,
    errors,
  };
};

type URLInputFormProps = {
  onSubmit: (url: string) => void;
  isLoading: boolean;
};

export default function URLInputForm({ onSubmit, isLoading }: URLInputFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: formResolver,
    defaultValues: {
      url: "",
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values.url);
  };

  const handleClear = () => {
    form.reset();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-medium text-slate-700 mb-1">Website URL</FormLabel>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Link2 className="h-5 w-5 text-slate-400" />
                    </div>
                    <FormControl>
                      <Input
                        placeholder="https://example.com"
                        className="focus:ring-primary focus:border-primary block w-full pl-10 pr-12 py-6 text-sm border-slate-300 rounded-md"
                        {...field}
                      />
                    </FormControl>
                    {field.value && (
                      <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                        <button
                          type="button"
                          onClick={handleClear}
                          className="inline-flex items-center border border-transparent rounded px-2 text-slate-400 hover:text-slate-500"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <FormMessage />
                  <p className="mt-1 text-xs text-slate-500">Enter any website URL to analyze its meta tags</p>
                </FormItem>
              )}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-blue-600 text-white font-medium py-6 px-6 rounded-md transition duration-150 ease-in-out flex items-center justify-center min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
