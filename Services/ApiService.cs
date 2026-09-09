using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

namespace TidalLauncher.Services;

public static class ApiService
{
    public const string Backend = "https://tidal-backend-klp9.onrender.com";

    private static readonly HttpClient Client = new()
    {
        Timeout = TimeSpan.FromSeconds(20)
    };

    public static async Task<JsonDocument?> GetMeAsync(string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{Backend}/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await Client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }

    public static async Task<JsonDocument?> GetStatusAsync()
    {
        using var response = await Client.GetAsync($"{Backend}/status");
        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
